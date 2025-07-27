-- Fix database function search paths for security
-- This fixes the search path vulnerabilities identified in the security audit

-- Update all functions to use secure search_path configuration
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update auto_start_trial function with secure search path
DROP FUNCTION IF EXISTS public.auto_start_trial();
CREATE OR REPLACE FUNCTION public.auto_start_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium';
    NEW.is_premium = true;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update comprehensive_cleanup function
DROP FUNCTION IF EXISTS public.comprehensive_cleanup();
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
  UPDATE profiles 
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
  UPDATE user_sessions
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

-- Update simple_session_manager function
DROP FUNCTION IF EXISTS public.simple_session_manager(uuid, text, text);
CREATE OR REPLACE FUNCTION public.simple_session_manager(p_user_id uuid, p_device_type text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text)
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

-- Update get_user_subscription_status function
DROP FUNCTION IF EXISTS public.get_user_subscription_status(uuid);
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
 RETURNS TABLE(current_tier text, current_status text, trial_end_date timestamp with time zone, is_trial_active boolean, is_premium_access boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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