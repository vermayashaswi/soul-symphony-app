-- Fix search path vulnerabilities for database functions
-- This addresses the critical security issue where functions without explicit search paths
-- can be vulnerable to search path attacks

-- Update auto_start_trial function
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now (updated from 7 days)
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium'; -- Fixed: Set to premium during trial
    NEW.is_premium = true; -- Grant premium access during trial
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update comprehensive_cleanup function
CREATE OR REPLACE FUNCTION public.comprehensive_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Update other critical functions with search path protection
CREATE OR REPLACE FUNCTION public.simple_session_manager(p_user_id uuid, p_device_type text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Update get_user_subscription_status function
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS TABLE(current_tier text, current_status text, trial_end_date timestamp with time zone, is_trial_active boolean, is_premium_access boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  -- Get profile data with optimized query
  SELECT 
    COALESCE(p.subscription_tier, 'free') as tier,
    COALESCE(p.subscription_status, 'free') as status,
    p.trial_ends_at,
    COALESCE(p.is_premium, false) as premium,
    p.created_at
  INTO profile_record
  FROM profiles p
  WHERE p.id = user_id_param;
  
  -- Return immediately if no profile found
  IF profile_record IS NULL THEN
    RETURN QUERY SELECT 
      'free'::text,
      'free'::text,
      NULL::timestamp with time zone,
      false,
      false;
    RETURN;
  END IF;
  
  -- Check if trial is active (not expired)
  DECLARE
    trial_active boolean := false;
  BEGIN
    IF profile_record.trial_ends_at IS NOT NULL THEN
      trial_active := profile_record.trial_ends_at > NOW();
    END IF;
    
    RETURN QUERY SELECT 
      profile_record.tier,
      profile_record.status,
      profile_record.trial_ends_at,
      trial_active,
      profile_record.premium;
  END;
END;
$function$;

-- Update set_default_translation_status function
CREATE OR REPLACE FUNCTION public.set_default_translation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.translation_status = 'completed';
  RETURN NEW;
END;
$function$;

-- Update close_user_session function
CREATE OR REPLACE FUNCTION public.close_user_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = NOW(),
    session_duration = NOW() - session_start
  WHERE 
    id = p_session_id 
    AND user_id = p_user_id 
    AND is_active = true;
    
  RETURN FOUND;
END;
$function$;

-- Update update_user_sessions_updated_at function
CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$function$;

-- Update cleanup_expired_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Close expired sessions
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW()),
    session_duration = COALESCE(session_duration, NOW() - session_start)
  WHERE 
    is_active = true 
    AND session_timeout < NOW();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$function$;