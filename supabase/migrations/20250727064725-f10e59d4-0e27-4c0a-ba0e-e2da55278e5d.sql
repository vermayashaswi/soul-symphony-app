-- =============================================================================
-- COMPLETE PHONE VERIFICATION REMOVAL AND BACKEND SIMPLIFICATION
-- =============================================================================

-- 1. DROP ALL PHONE VERIFICATION RELATED FUNCTIONS
DROP FUNCTION IF EXISTS public.send_phone_verification(text, uuid);
DROP FUNCTION IF EXISTS public.verify_phone_code(text, text, uuid);
DROP FUNCTION IF EXISTS public.check_sms_rate_limit(text, uuid);
DROP FUNCTION IF EXISTS public.cleanup_expired_phone_verifications();

-- 2. DROP PHONE VERIFICATION TABLE (if exists)
DROP TABLE IF EXISTS public.phone_verifications CASCADE;

-- 3. REMOVE PHONE VERIFICATION COLUMNS FROM PROFILES
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS phone_number,
DROP COLUMN IF EXISTS phone_verified,
DROP COLUMN IF EXISTS phone_verified_at;

-- 4. DROP COMPLEX SESSION MANAGEMENT FUNCTIONS
DROP FUNCTION IF EXISTS public.enhanced_manage_user_session(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_user_session(uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.enhanced_session_manager(uuid, text, text, text, text, text, text, text, text, text, integer, bigint, text, jsonb);

-- 5. DROP COMPLEX RATE LIMITING FUNCTIONS
DROP FUNCTION IF EXISTS public.enhanced_rate_limit_check(uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.enhanced_check_rate_limit(uuid, inet, text);

-- 6. SIMPLIFY USER SESSIONS TABLE - Remove complex columns
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

-- 7. REPLACE COMPLEX PROFILE TRIGGER WITH SIMPLE ONE
DROP TRIGGER IF EXISTS handle_new_profile ON public.profiles;
DROP TRIGGER IF EXISTS handle_new_profile_optimized ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_profile();
DROP FUNCTION IF EXISTS public.handle_new_profile_optimized();

-- Use the existing auto_start_trial function for new profiles
CREATE TRIGGER handle_new_profile
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_start_trial();

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

-- 10. SIMPLIFY CORE FUNCTIONS - Keep only essential ones
-- Remove references to phone verification from remaining functions
CREATE OR REPLACE FUNCTION public.get_user_profile_with_trial(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_data RECORD;
  is_trial_active BOOLEAN := false;
  result JSONB;
BEGIN
  -- Verify user can access this profile
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Get profile with subscription info
  SELECT * INTO profile_data
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF profile_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Check trial status
  IF profile_data.trial_ends_at IS NOT NULL THEN
    is_trial_active := profile_data.trial_ends_at > NOW();
  END IF;
  
  -- Build result without phone verification fields
  result := jsonb_build_object(
    'id', profile_data.id,
    'email', profile_data.email,
    'full_name', profile_data.full_name,
    'display_name', profile_data.display_name,
    'avatar_url', profile_data.avatar_url,
    'subscription_status', COALESCE(profile_data.subscription_status, 'free'),
    'subscription_tier', COALESCE(profile_data.subscription_tier, 'free'),
    'is_premium', COALESCE(profile_data.is_premium, false),
    'trial_ends_at', profile_data.trial_ends_at,
    'is_trial_active', is_trial_active,
    'onboarding_completed', COALESCE(profile_data.onboarding_completed, false),
    'created_at', profile_data.created_at,
    'updated_at', profile_data.updated_at
  );
  
  RETURN result;
END;
$function$;

-- 11. CLEAN UP COMPREHENSIVE CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION public.comprehensive_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  expired_trials INTEGER := 0;
  expired_sessions INTEGER := 0;
  result JSONB;
BEGIN
  -- Clean up expired trials
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    subscription_tier = 'free',
    is_premium = false,
    updated_at = NOW()
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS expired_trials = ROW_COUNT;
  
  -- Clean up expired sessions
  UPDATE public.user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW())
  WHERE 
    is_active = true 
    AND last_activity < NOW() - INTERVAL '24 hours';
    
  GET DIAGNOSTICS expired_sessions = ROW_COUNT;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'expired_trials_cleaned', expired_trials,
    'expired_sessions_cleaned', expired_sessions,
    'message', 'Cleanup completed'
  );
  
  RETURN result;
END;
$function$;

-- 12. ENSURE RLS IS PROPERLY CONFIGURED
-- Reset and recreate essential RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Reset Journal Entries policies
DROP POLICY IF EXISTS "Users can view own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can update own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public."Journal Entries";

CREATE POLICY "Users can view own journal entries" 
  ON public."Journal Entries" FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries" 
  ON public."Journal Entries" FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries" 
  ON public."Journal Entries" FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries" 
  ON public."Journal Entries" FOR DELETE 
  USING (auth.uid() = user_id);

-- 13. SIMPLIFY SESSION MANAGEMENT
CREATE OR REPLACE FUNCTION public.simple_session_manager(p_user_id uuid, p_device_type text DEFAULT NULL, p_entry_page text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_id uuid;
BEGIN
  -- Verify user authentication
  IF auth.uid() != p_user_id THEN
    RETURN NULL;
  END IF;

  -- Close any existing active sessions for this user
  UPDATE user_sessions 
  SET 
    is_active = false,
    session_end = NOW()
  WHERE 
    user_id = p_user_id 
    AND is_active = true;

  -- Create new simple session
  INSERT INTO user_sessions (
    user_id, 
    device_type, 
    entry_page,
    last_activity
  ) VALUES (
    p_user_id, 
    p_device_type, 
    p_entry_page,
    NOW()
  ) RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$function$;