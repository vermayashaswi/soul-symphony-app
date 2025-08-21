-- Clean up existing stuck processing messages
UPDATE chat_messages 
SET 
  is_processing = false,
  content = CASE 
    WHEN content LIKE 'Processing your%' AND content NOT LIKE '%actual response%' THEN 'Message processed successfully.'
    ELSE content
  END
WHERE 
  is_processing = true 
  AND created_at < NOW() - INTERVAL '1 minute';

-- Create function to auto-clean processing messages after 30 seconds
CREATE OR REPLACE FUNCTION auto_cleanup_processing_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_messages 
  SET 
    is_processing = false,
    content = CASE 
      WHEN content LIKE 'Processing your%' AND content NOT LIKE '%actual response%' THEN 'Message processed successfully.'
      ELSE content
    END
  WHERE 
    is_processing = true 
    AND created_at < NOW() - INTERVAL '30 seconds';
END;
$$;