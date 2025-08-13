-- Ensure idempotent assistant message persistence using proper indexes
-- 1) Partial unique index on (thread_id, idempotency_key) when idempotency_key is present
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_thread_id_idempotency_key_unique
ON public.chat_messages (thread_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2) Helpful non-unique index on thread_id for fast lookups
CREATE INDEX IF NOT EXISTS chat_messages_thread_id_idx
ON public.chat_messages (thread_id);

-- 3) Clean up legacy indexes that may conflict with the new idempotency strategy
-- Drop any index that is solely on (idempotency_key) without thread_id
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT i.relname AS indexname, pg_get_indexdef(ix.indexrelid) AS def
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON ix.indexrelid = i.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'chat_messages'
  LOOP
    IF position('(idempotency_key)' in rec.def) > 0 AND position('(thread_id, idempotency_key)' in rec.def) = 0 THEN
      EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(rec.indexname);
    END IF;
  END LOOP;
END $$;
