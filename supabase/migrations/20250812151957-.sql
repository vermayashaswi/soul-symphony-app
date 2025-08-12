-- Add unique index to support ON CONFLICT (thread_id, idempotency_key)
-- and prevent duplicate assistant message upserts in the same thread
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_thread_id_idempotency_key_uniq
ON public.chat_messages (thread_id, idempotency_key);
