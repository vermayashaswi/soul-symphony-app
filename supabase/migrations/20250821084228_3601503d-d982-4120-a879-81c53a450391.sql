-- Drop and recreate functions with correct signatures
DROP FUNCTION IF EXISTS public.cleanup_stuck_processing_messages();

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