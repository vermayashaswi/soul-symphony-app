-- Add notification preferences to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "master_notifications": false,
  "in_app_notifications": true,
  "insightful_reminders": true,
  "journaling_reminders": true
}'::jsonb;

-- Create index for efficient queries on notification preferences
CREATE INDEX IF NOT EXISTS idx_profiles_notification_preferences 
ON profiles USING GIN (notification_preferences);

-- Add updated_at trigger for notification preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;