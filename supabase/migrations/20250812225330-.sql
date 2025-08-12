-- Ensure idempotency support for assistant message persistence
-- 1) Add idempotency_key column if missing
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2) Create a unique partial index to prevent duplicates when idempotency_key is provided
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_thread_id_idempotency_key_uniq
ON public.chat_messages (thread_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3) Helpful secondary index for faster lookups by thread (optional but safe)
CREATE INDEX IF NOT EXISTS chat_messages_thread_id_idx
ON public.chat_messages (thread_id);
