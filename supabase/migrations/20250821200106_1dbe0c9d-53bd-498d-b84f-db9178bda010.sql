-- Restore missing columns to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS idempotency_key text,
ADD COLUMN IF NOT EXISTS request_correlation_id text,
ADD COLUMN IF NOT EXISTS sub_query1 text,
ADD COLUMN IF NOT EXISTS sub_query2 text, 
ADD COLUMN IF NOT EXISTS sub_query3 text,
ADD COLUMN IF NOT EXISTS sub_query_responses jsonb,
ADD COLUMN IF NOT EXISTS is_processing boolean DEFAULT false;

-- Create index on idempotency_key for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_idempotency_key ON public.chat_messages(idempotency_key);

-- Create index on request_correlation_id for tracking
CREATE INDEX IF NOT EXISTS idx_chat_messages_request_correlation_id ON public.chat_messages(request_correlation_id);

-- Update existing messages to have role based on sender for consistency
UPDATE public.chat_messages 
SET role = sender 
WHERE role IS NULL;