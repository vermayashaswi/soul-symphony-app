-- Clean up duplicate idempotency indexes and enhance constraints
DROP INDEX IF EXISTS chat_messages_thread_id_idempotency_key_uniq;
DROP INDEX IF EXISTS chat_messages_thread_id_idempotency_key_unique;
DROP INDEX IF EXISTS ux_chat_messages_thread_id_idempotency_key;

-- Keep only the main idempotency index
-- chat_messages_thread_id_idempotency_key_key should remain

-- Add is_processing column to track message processing state
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_processing BOOLEAN DEFAULT false;

-- Add request_correlation_id for enhanced debugging and tracking
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS request_correlation_id TEXT;

-- Create index for correlation ID lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_correlation_id 
ON chat_messages(request_correlation_id) 
WHERE request_correlation_id IS NOT NULL;

-- Create index for processing messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_processing 
ON chat_messages(thread_id, is_processing, created_at) 
WHERE is_processing = true;

-- Add a function to validate thread ownership before operations
CREATE OR REPLACE FUNCTION validate_thread_ownership(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_threads 
    WHERE id = p_thread_id AND user_id = p_user_id
  );
END;
$$;

-- Add a function to clean up old processing messages (stuck in processing state)
CREATE OR REPLACE FUNCTION cleanup_stuck_processing_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Reset processing flag for messages older than 5 minutes
  UPDATE chat_messages
  SET is_processing = false
  WHERE is_processing = true 
    AND created_at < NOW() - INTERVAL '5 minutes';
    
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;

-- Add RLS policy to prevent cross-thread message access
CREATE OR REPLACE FUNCTION thread_belongs_to_user(thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_threads ct 
    WHERE ct.id = thread_id AND ct.user_id = auth.uid()
  );
$$;