-- =============================================================================
-- COMPLETE PHONE VERIFICATION REMOVAL AND BACKEND SIMPLIFICATION - CASCADE
-- =============================================================================

-- 1. DROP FUNCTIONS WITH CASCADE TO REMOVE ALL DEPENDENT TRIGGERS
DROP FUNCTION IF EXISTS public.handle_new_profile() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_profile_optimized() CASCADE;

-- 2. DROP ALL PHONE VERIFICATION RELATED FUNCTIONS
DROP FUNCTION IF EXISTS public.send_phone_verification(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.verify_phone_code(text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_sms_rate_limit(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_phone_verifications() CASCADE;

-- 3. DROP PHONE VERIFICATION TABLE (if exists)
DROP TABLE IF EXISTS public.phone_verifications CASCADE;

-- 4. REMOVE PHONE VERIFICATION COLUMNS FROM PROFILES
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS phone_number,
DROP COLUMN IF EXISTS phone_verified,
DROP COLUMN IF EXISTS phone_verified_at;

-- 5. DROP COMPLEX SESSION MANAGEMENT FUNCTIONS
DROP FUNCTION IF EXISTS public.enhanced_manage_user_session(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, jsonb, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_user_session(uuid, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.enhanced_session_manager(uuid, text, text, text, text, text, text, text, text, text, integer, bigint, text, jsonb) CASCADE;

-- 6. DROP COMPLEX RATE LIMITING FUNCTIONS
DROP FUNCTION IF EXISTS public.enhanced_rate_limit_check(uuid, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.enhanced_check_rate_limit(uuid, inet, text) CASCADE;

-- 7. SIMPLIFY USER SESSIONS TABLE - Remove complex columns
ALTER TABLE public.user_sessions
DROP COLUMN IF EXISTS session_fingerprint,
DROP COLUMN IF EXISTS session_quality_score,
DROP COLUMN IF EXISTS memory_usage,
DROP COLUMN IF EXISTS battery_level,
DROP COLUMN IF EXISTS browser_info,
DROP COLUMN IF EXISTS session_timeout,
DROP COLUMN IF EXISTS conversion_events,
DROP COLUMN IF EXISTS attribution_data,
DROP COLUMN IF EXISTS session_duration,
DROP COLUMN IF EXISTS error_count,
DROP COLUMN IF EXISTS crash_count,
DROP COLUMN IF EXISTS app_launch_count,
DROP COLUMN IF EXISTS device_fingerprint,
DROP COLUMN IF EXISTS session_state,
DROP COLUMN IF EXISTS app_version,
DROP COLUMN IF EXISTS network_state,
DROP COLUMN IF EXISTS background_start_time,
DROP COLUMN IF EXISTS last_renewal_at,
DROP COLUMN IF EXISTS session_renewal_count,
DROP COLUMN IF EXISTS foreground_time,
DROP COLUMN IF EXISTS background_time,
DROP COLUMN IF EXISTS foreground_start_time,
DROP COLUMN IF EXISTS inactivity_duration;

-- 8. SIMPLIFY API USAGE TABLE - Remove unnecessary columns
ALTER TABLE public.api_usage
DROP COLUMN IF EXISTS request_payload_size,
DROP COLUMN IF EXISTS response_payload_size,
DROP COLUMN IF EXISTS user_agent,
DROP COLUMN IF EXISTS referer,
DROP COLUMN IF EXISTS rate_limit_hit,
DROP COLUMN IF EXISTS rate_limit_type;

-- 9. DROP RATE LIMIT CONFIG TABLE (overly complex)
DROP TABLE IF EXISTS public.rate_limit_config CASCADE;

-- 10. RECREATE SIMPLE PROFILE TRIGGER USING EXISTING AUTO_START_TRIAL FUNCTION
CREATE TRIGGER handle_new_profile
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_start_trial();