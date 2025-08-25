-- Update reminder_settings column structure to support custom times
-- This will change the column to support new format: 
-- {"reminders": [{"id": "1", "enabled": true, "time": "08:00", "label": "Morning reflection"}, {"id": "2", "enabled": false, "time": "14:00", "label": "Afternoon check-in"}]}

-- First, let's update the profiles table to ensure reminder_settings can handle the new structure
COMMENT ON COLUMN profiles.reminder_settings IS 'JSON structure: {"reminders": [{"id": string, "enabled": boolean, "time": string (HH:MM), "label": string}]}';

-- Create function to schedule journal reminders (will be called by cron job)
CREATE OR REPLACE FUNCTION public.schedule_journal_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reminder_count INTEGER := 0;
  user_record RECORD;
  reminder_record RECORD;
  user_timezone_offset TEXT;
  scheduled_time TIMESTAMP WITH TIME ZONE;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
  result JSONB;
BEGIN
  -- Loop through all users with enabled reminders
  FOR user_record IN 
    SELECT id, reminder_settings, timezone, email
    FROM profiles 
    WHERE reminder_settings IS NOT NULL
      AND (reminder_settings->>'enabled')::boolean = true
      OR jsonb_typeof(reminder_settings->'reminders') = 'array'
  LOOP
    -- Handle both old and new reminder_settings formats
    IF jsonb_typeof(user_record.reminder_settings->'reminders') = 'array' THEN
      -- New format: iterate through reminders array
      FOR reminder_record IN
        SELECT jsonb_array_elements(user_record.reminder_settings->'reminders') as reminder_data
      LOOP
        -- Check if this reminder is enabled
        IF (reminder_record.reminder_data->>'enabled')::boolean = true THEN
          -- Calculate next scheduled time in user's timezone
          user_timezone_offset := COALESCE(user_record.timezone, 'UTC');
          
          -- Get today's time for this reminder in user's timezone
          scheduled_time := (CURRENT_DATE || ' ' || (reminder_record.reminder_data->>'time'))::timestamp 
                           AT TIME ZONE user_timezone_offset 
                           AT TIME ZONE 'UTC';
          
          -- If time has passed today, schedule for tomorrow
          IF scheduled_time <= current_time THEN
            scheduled_time := scheduled_time + INTERVAL '1 day';
          END IF;
          
          -- Insert notification event (this will be processed by notification delivery function)
          INSERT INTO notification_queue (
            user_id,
            notification_type,
            scheduled_for,
            title,
            body,
            data
          ) VALUES (
            user_record.id,
            'journal_reminder',
            scheduled_time,
            'Time for your journal reflection',
            COALESCE(reminder_record.reminder_data->>'label', 'Take a moment to reflect on your day'),
            jsonb_build_object(
              'reminder_id', reminder_record.reminder_data->>'id',
              'reminder_time', reminder_record.reminder_data->>'time',
              'user_timezone', user_timezone_offset
            )
          );
          
          reminder_count := reminder_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  result := jsonb_build_object(
    'success', true,
    'scheduled_reminders', reminder_count,
    'processed_at', current_time
  );
  
  RETURN result;
END;
$$;

-- Create notification queue table for managing scheduled notifications
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for notification_queue
CREATE POLICY "Users can view their own notifications"
ON public.notification_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage notifications"
ON public.notification_queue
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled 
ON public.notification_queue (scheduled_for, status, user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_queue_updated_at
BEFORE UPDATE ON public.notification_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();