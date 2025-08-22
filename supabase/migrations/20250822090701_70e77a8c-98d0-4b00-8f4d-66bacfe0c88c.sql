-- Remove the complex deduplication function and use simple INSERT
DROP FUNCTION IF EXISTS public.create_chat_message_with_dedup(uuid, text, text, text, text);

-- Remove idempotency_key column if it exists
ALTER TABLE chat_messages DROP COLUMN IF EXISTS idempotency_key;