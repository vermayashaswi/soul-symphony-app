-- Create function to cleanup stuck processing messages
CREATE OR REPLACE FUNCTION public.cleanup_stuck_processing_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cleanup_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Update messages that have been stuck in processing state for more than 5 minutes
  UPDATE chat_messages
  SET 
    is_processing = false,
    content = COALESCE(
      content, 
      'I encountered an issue processing your request. Please try asking again.'
    ),
    updated_at = NOW()
  WHERE 
    is_processing = true 
    AND created_at < NOW() - INTERVAL '5 minutes'
    AND sender = 'assistant';
    
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'messages_cleaned_up', cleanup_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$function$;