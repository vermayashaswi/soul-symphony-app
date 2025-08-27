-- Fix the journal entry notification to redirect to past entries tab
CREATE OR REPLACE FUNCTION public.notify_journal_entry_saved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    '/app/journal?tab=entries',
    'View Entry'
  );
  
  RETURN NEW;
END;
$function$