-- Update notification preferences schema to simplified version
-- This migration updates existing users to the new simplified schema

-- First, let's see what we're working with
-- Update all existing notification_preferences to the simplified structure
UPDATE profiles 
SET notification_preferences = jsonb_build_object(
  'master_notifications', COALESCE((notification_preferences->>'master_notifications')::boolean, false),
  'journaling_reminders', COALESCE((notification_preferences->>'journaling_reminders')::boolean, true)
)
WHERE notification_preferences IS NOT NULL;

-- Set default for users without preferences
UPDATE profiles 
SET notification_preferences = jsonb_build_object(
  'master_notifications', false,
  'journaling_reminders', true
)
WHERE notification_preferences IS NULL;