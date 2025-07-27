-- Drop trigger first, then complex functions and tables
-- This addresses the dependency error from previous migration

-- 1. Drop triggers that depend on functions we want to remove
DROP TRIGGER IF EXISTS update_session_quality_trigger ON public.user_sessions;

-- 2. Now drop the complex session and rate limiting functions
DROP FUNCTION IF EXISTS public.enhanced_session_manager(uuid, text, text, text, text, text, text, text, text, integer, bigint, text, jsonb);
DROP FUNCTION IF EXISTS public.check_rate_limit(uuid, inet, text);
DROP FUNCTION IF EXISTS public.log_api_usage(uuid, inet, text, text, text, integer, integer, integer, numeric, boolean, text, text, text, integer, integer, text);
DROP FUNCTION IF EXISTS public.calculate_session_quality_score(interval, integer, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.update_session_quality_score();
DROP FUNCTION IF EXISTS public.track_conversion_event(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.get_attribution_analytics(timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.validate_phone_number(text);
DROP FUNCTION IF EXISTS public.security_audit();
DROP FUNCTION IF EXISTS public.execute_dynamic_query(text, text[]);

-- 3. Remove complex rate limiting and API usage tables
DROP TABLE IF EXISTS public.api_usage CASCADE;
DROP TABLE IF EXISTS public.openai_usage CASCADE;

-- 4. Remove complex session tracking columns from user_sessions
ALTER TABLE public.user_sessions 
DROP COLUMN IF EXISTS utm_source,
DROP COLUMN IF EXISTS utm_medium, 
DROP COLUMN IF EXISTS utm_campaign,
DROP COLUMN IF EXISTS utm_term,
DROP COLUMN IF EXISTS utm_content,
DROP COLUMN IF EXISTS gclid,
DROP COLUMN IF EXISTS fbclid,
DROP COLUMN IF EXISTS referrer,
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS currency,
DROP COLUMN IF EXISTS country_code,
DROP COLUMN IF EXISTS language;