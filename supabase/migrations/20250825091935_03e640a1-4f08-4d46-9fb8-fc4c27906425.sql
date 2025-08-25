-- Update the schedule_journal_reminders function to use custom labels as title
CREATE OR REPLACE FUNCTION public.schedule_journal_reminders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          
          -- Insert notification event with custom label as title
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
            COALESCE(reminder_record.reminder_data->>'label', 'Journal Reminder'),
            'Time for your journal reflection',
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
$function$