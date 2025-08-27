-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS user_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error', 'reminder'
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NULL,
  action_url TEXT NULL,
  action_label TEXT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_app_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications" 
ON user_app_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON user_app_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" 
ON user_app_notifications 
FOR INSERT 
WITH CHECK (true);

-- Create function to send notifications on journal entry creation
CREATE OR REPLACE FUNCTION notify_journal_entry_saved()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a congratulatory notification for new journal entries
  INSERT INTO user_app_notifications (
    user_id,
    title,
    message,
    type,
    data,
    action_url,
    action_label
  ) VALUES (
    NEW.user_id,
    '🎉 Journal Entry Saved!',
    'Great job reflecting on your thoughts and feelings.',
    'success',
    jsonb_build_object('journal_entry_id', NEW.id),
    '/app/journal',
    'View Entry'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for journal entry notifications
DROP TRIGGER IF EXISTS journal_entry_notification_trigger ON "Journal Entries";
CREATE TRIGGER journal_entry_notification_trigger
  AFTER INSERT ON "Journal Entries"
  FOR EACH ROW
  EXECUTE FUNCTION notify_journal_entry_saved();

-- Create function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete notifications older than 30 days or already dismissed for 7 days
  DELETE FROM user_app_notifications
  WHERE 
    created_at < NOW() - INTERVAL '30 days'
    OR (dismissed_at IS NOT NULL AND dismissed_at < NOW() - INTERVAL '7 days')
    OR (expires_at IS NOT NULL AND expires_at < NOW());
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at trigger
CREATE TRIGGER update_user_app_notifications_updated_at
  BEFORE UPDATE ON user_app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();