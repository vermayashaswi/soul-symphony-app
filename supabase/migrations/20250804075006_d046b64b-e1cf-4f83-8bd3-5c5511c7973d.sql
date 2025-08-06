-- Remove database functions that reference the non-existent api_usage table
DROP FUNCTION IF EXISTS public.check_rate_limit(uuid, text, text);
DROP FUNCTION IF EXISTS public.log_api_usage(uuid, text, text, text, text, integer, integer, integer, numeric, text, boolean);