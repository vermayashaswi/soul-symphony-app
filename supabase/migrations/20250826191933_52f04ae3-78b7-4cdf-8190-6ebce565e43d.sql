-- Create FCM token storage table
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_token)
);

-- Enable RLS
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own devices" 
ON user_devices 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create notification preferences table
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('journal_reminder', 'motivational', 'streak', 'engagement')),
  scheduled_time TIME NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own notifications" 
ON user_notifications 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create update triggers for both tables
CREATE TRIGGER update_user_devices_updated_at
  BEFORE UPDATE ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notifications_updated_at
  BEFORE UPDATE ON user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Drop the old notification_queue table
DROP TABLE IF EXISTS notification_queue;

-- Remove notification scheduler functions
DROP FUNCTION IF EXISTS schedule_journal_reminders();

-- Migrate existing reminder_settings to user_notifications
INSERT INTO user_notifications (user_id, type, scheduled_time, title, body, status)
SELECT 
  p.id,
  'journal_reminder',
  (reminder_data->>'time')::TIME,
  COALESCE(reminder_data->>'label', 'Journal Reminder'),
  'Time for your journal reflection',
  CASE WHEN (reminder_data->>'enabled')::boolean THEN 'active' ELSE 'inactive' END
FROM profiles p,
     jsonb_array_elements(p.reminder_settings->'reminders') AS reminder_data
WHERE p.reminder_settings IS NOT NULL 
  AND jsonb_typeof(p.reminder_settings->'reminders') = 'array';