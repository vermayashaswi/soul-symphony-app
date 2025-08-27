-- Fix the newly added functions to have proper search_path security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fix cleanup function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';