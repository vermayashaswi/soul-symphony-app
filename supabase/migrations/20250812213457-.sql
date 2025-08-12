-- Ensure idempotent assistant message writes via unique idempotency key per thread
CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_messages_thread_id_idempotency_key
ON public.chat_messages (thread_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;