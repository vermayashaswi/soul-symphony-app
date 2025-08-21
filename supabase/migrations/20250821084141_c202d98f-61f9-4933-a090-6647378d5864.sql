-- Add message persistence health monitoring function
CREATE OR REPLACE FUNCTION public.check_message_persistence_health(
  thread_id_param UUID,
  expected_message_count INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_count INTEGER;
  assistant_count INTEGER;
  user_count INTEGER;
  missing_idempotency_count INTEGER;
  recent_failures INTEGER;
  health_score NUMERIC;
  issues TEXT[] := '{}';
  result JSONB;
BEGIN
  -- Count total messages
  SELECT COUNT(*) INTO actual_count
  FROM chat_messages 
  WHERE thread_id = thread_id_param;
  
  -- Count by sender type
  SELECT 
    COUNT(CASE WHEN sender = 'assistant' THEN 1 END),
    COUNT(CASE WHEN sender = 'user' THEN 1 END)
  INTO assistant_count, user_count
  FROM chat_messages 
  WHERE thread_id = thread_id_param;
  
  -- Count messages without idempotency keys (recent ones should have them)
  SELECT COUNT(*) INTO missing_idempotency_count
  FROM chat_messages 
  WHERE thread_id = thread_id_param 
    AND idempotency_key IS NULL 
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Count recent failed processing messages
  SELECT COUNT(*) INTO recent_failures
  FROM chat_messages 
  WHERE thread_id = thread_id_param 
    AND is_processing = true 
    AND created_at < NOW() - INTERVAL '5 minutes';
  
  -- Calculate health score (0-100)
  health_score := 100;
  
  -- Check expected count if provided
  IF expected_message_count IS NOT NULL AND actual_count != expected_message_count THEN
    issues := array_append(issues, format('Expected %s messages, found %s', expected_message_count, actual_count));
    health_score := health_score - 30;
  END IF;
  
  -- Check for stuck processing messages
  IF recent_failures > 0 THEN
    issues := array_append(issues, format('%s messages stuck in processing state', recent_failures));
    health_score := health_score - 25;
  END IF;
  
  -- Check for missing idempotency keys
  IF missing_idempotency_count > 0 THEN
    issues := array_append(issues, format('%s recent messages missing idempotency keys', missing_idempotency_count));
    health_score := health_score - 15;
  END IF;
  
  -- Check message balance (should have both user and assistant messages for active threads)
  IF actual_count > 1 AND (user_count = 0 OR assistant_count = 0) THEN
    issues := array_append(issues, 'Imbalanced conversation: missing user or assistant messages');
    health_score := health_score - 20;
  END IF;
  
  -- Ensure health score doesn't go below 0
  health_score := GREATEST(0, health_score);
  
  result := jsonb_build_object(
    'thread_id', thread_id_param,
    'health_score', health_score,
    'is_healthy', health_score >= 80,
    'total_messages', actual_count,
    'user_messages', user_count,
    'assistant_messages', assistant_count,
    'missing_idempotency_keys', missing_idempotency_count,
    'stuck_processing_messages', recent_failures,
    'issues', to_jsonb(issues),
    'checked_at', NOW()
  );
  
  RETURN result;
END;
$$;

-- Add function to clean up stuck processing messages
CREATE OR REPLACE FUNCTION public.cleanup_stuck_processing_messages()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count INTEGER;
  result JSONB;
BEGIN
  -- Update messages that have been stuck in processing for more than 5 minutes
  UPDATE chat_messages 
  SET 
    is_processing = false,
    content = CASE 
      WHEN content = 'Processing your journal query...' THEN 'Sorry, there was an issue processing your request. Please try again.'
      WHEN content LIKE 'Processing%' THEN 'Sorry, there was an issue processing your request. Please try again.'
      ELSE content
    END
  WHERE 
    is_processing = true 
    AND created_at < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'cleaned_messages', cleaned_count,
    'cleaned_at', NOW()
  );
  
  RETURN result;
END;
$$;

-- Add trigger to automatically update thread timestamp when messages are inserted/updated
CREATE OR REPLACE FUNCTION public.update_thread_on_message_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the thread's updated_at timestamp
  UPDATE chat_threads 
  SET updated_at = NOW() 
  WHERE id = COALESCE(NEW.thread_id, OLD.thread_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for automatic thread timestamp updates
DROP TRIGGER IF EXISTS trigger_update_thread_on_message_insert ON chat_messages;
CREATE TRIGGER trigger_update_thread_on_message_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_on_message_change();

DROP TRIGGER IF EXISTS trigger_update_thread_on_message_update ON chat_messages;
CREATE TRIGGER trigger_update_thread_on_message_update
  AFTER UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_on_message_change();

-- Add improved upsert function for messages with better conflict handling
CREATE OR REPLACE FUNCTION public.upsert_chat_message(
  p_thread_id UUID,
  p_content TEXT,
  p_sender TEXT,
  p_role TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_analysis_data JSONB DEFAULT NULL,
  p_reference_entries JSONB DEFAULT NULL,
  p_is_processing BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  message_id UUID;
  was_updated BOOLEAN := false;
  result JSONB;
BEGIN
  -- Set role to sender if not provided
  IF p_role IS NULL THEN
    p_role := p_sender;
  END IF;
  
  -- Generate idempotency key if not provided
  IF p_idempotency_key IS NULL THEN
    p_idempotency_key := extract(epoch from now())::text || '_' || 
                         encode(digest(p_thread_id::text || p_content || p_sender, 'sha256'), 'hex')::text;
  END IF;
  
  -- Try to insert, handle conflict
  INSERT INTO chat_messages (
    thread_id,
    content,
    sender,
    role,
    idempotency_key,
    analysis_data,
    reference_entries,
    is_processing,
    created_at
  ) VALUES (
    p_thread_id,
    p_content,
    p_sender,
    p_role,
    p_idempotency_key,
    p_analysis_data,
    p_reference_entries,
    p_is_processing,
    NOW()
  )
  ON CONFLICT (thread_id, idempotency_key) 
  DO UPDATE SET
    content = EXCLUDED.content,
    analysis_data = EXCLUDED.analysis_data,
    reference_entries = EXCLUDED.reference_entries,
    is_processing = EXCLUDED.is_processing
  RETURNING id INTO message_id;
  
  -- Check if this was an update (existing message)
  GET DIAGNOSTICS was_updated = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'message_id', message_id,
    'was_updated', was_updated,
    'idempotency_key', p_idempotency_key
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
  RETURN result;
END;
$$;