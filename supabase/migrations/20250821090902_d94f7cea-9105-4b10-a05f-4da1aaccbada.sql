-- Function to clean up existing malformed JSON messages
CREATE OR REPLACE FUNCTION public.cleanup_malformed_json_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count INTEGER := 0;
  total_malformed INTEGER := 0;
  result JSONB;
BEGIN
  -- Count malformed messages (content that looks like JSON)
  SELECT COUNT(*) INTO total_malformed
  FROM chat_messages 
  WHERE sender = 'assistant' 
    AND content LIKE '{%}%'
    AND content LIKE '%"response"%'
    AND content LIKE '%"userStatusMessage"%';
  
  -- Fix messages where content is a JSON string instead of the response content
  UPDATE chat_messages
  SET content = CASE
    -- Try to extract response field from JSON
    WHEN content LIKE '{%}%' AND content LIKE '%"response"%' THEN
      COALESCE(
        (content::jsonb)->>'response',
        'I processed your request but encountered a formatting issue. Please try asking again.'
      )
    ELSE content
  END
  WHERE sender = 'assistant' 
    AND content LIKE '{%}%'
    AND content LIKE '%"response"%'
    AND content LIKE '%"userStatusMessage"%';
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'total_malformed_found', total_malformed,
    'messages_fixed', fixed_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- Function to prevent JSON content from being stored in message content
CREATE OR REPLACE FUNCTION public.validate_message_content()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if content looks like JSON for assistant messages
  IF NEW.sender = 'assistant' AND NEW.content IS NOT NULL THEN
    IF NEW.content LIKE '{%}%' AND NEW.content LIKE '%"response"%' THEN
      -- Try to extract the response field
      BEGIN
        NEW.content := COALESCE(
          (NEW.content::jsonb)->>'response',
          'Content formatting issue detected.'
        );
      EXCEPTION WHEN OTHERS THEN
        -- If JSON parsing fails, leave content as is but log
        RAISE WARNING 'Failed to parse JSON content in message: %', NEW.id;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate message content before insert/update
DROP TRIGGER IF EXISTS validate_message_content_trigger ON chat_messages;
CREATE TRIGGER validate_message_content_trigger
  BEFORE INSERT OR UPDATE OF content ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_message_content();