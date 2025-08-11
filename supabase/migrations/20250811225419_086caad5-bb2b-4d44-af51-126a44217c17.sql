-- Add idempotency key to prevent duplicate assistant messages per thread
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Create a partial unique index to enforce idempotency when key is provided
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_thread_id_idempotency_key_key
ON public.chat_messages(thread_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;