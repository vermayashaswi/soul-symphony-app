-- Remove unnecessary columns from chat_messages table
ALTER TABLE public.chat_messages 
DROP COLUMN IF EXISTS idempotency_key,
DROP COLUMN IF EXISTS request_correlation_id,
DROP COLUMN IF EXISTS role,
DROP COLUMN IF EXISTS sub_query1,
DROP COLUMN IF EXISTS sub_query2,
DROP COLUMN IF EXISTS sub_query3,
DROP COLUMN IF EXISTS sub_query_responses;