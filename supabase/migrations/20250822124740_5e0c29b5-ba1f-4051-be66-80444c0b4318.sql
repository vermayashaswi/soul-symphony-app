-- Remove the duplicate execute_dynamic_query function (the basic one)
-- Keep only the enhanced version with timezone support
DROP FUNCTION IF EXISTS public.execute_dynamic_query(text);

-- The enhanced version with timezone support will remain:
-- execute_dynamic_query(query_text text, user_timezone text DEFAULT 'UTC'::text)