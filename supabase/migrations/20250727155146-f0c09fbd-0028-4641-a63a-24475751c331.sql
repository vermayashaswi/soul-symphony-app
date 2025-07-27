-- Fix remaining database function search path vulnerabilities
-- Complete the security fix for all database functions

-- Update remaining functions with search path protection
CREATE OR REPLACE FUNCTION public.get_user_profile_with_trial(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  FROM profiles
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

-- Update check_trial_expiry function
CREATE OR REPLACE FUNCTION public.check_trial_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE profiles 
  SET 
    subscription_status = 'free',
    is_premium = false
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at < NOW();
END;
$function$;

-- Update setup_user_trial_fallback function
CREATE OR REPLACE FUNCTION public.setup_user_trial_fallback(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  trial_duration_days INTEGER := 14;
  result JSONB;
BEGIN
  -- Update user profile with trial settings
  UPDATE profiles 
  SET 
    trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL,
    subscription_status = 'trial',
    subscription_tier = 'premium',
    is_premium = true,
    updated_at = NOW()
  WHERE id = user_id;
  
  IF FOUND THEN
    result := jsonb_build_object(
      'success', true,
      'message', 'Trial setup completed',
      'trial_ends_at', (NOW() + (trial_duration_days || ' days')::INTERVAL)
    );
  ELSE
    result := jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;
  
  RETURN result;
END;
$function$;

-- Update is_trial_eligible function
CREATE OR REPLACE FUNCTION public.is_trial_eligible(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  has_had_trial boolean := false;
BEGIN
  -- Check if user ever had a trial (simplified check)
  SELECT EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE id = user_id_param 
    AND trial_ends_at IS NOT NULL
  ) INTO has_had_trial;
  
  -- User is eligible if they never had a trial
  RETURN NOT has_had_trial;
END;
$function$;

-- Update auto_check_trial_expiry function
CREATE OR REPLACE FUNCTION public.auto_check_trial_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  -- If this is a trial user, check if their trial has expired
  IF NEW.subscription_status = 'trial' AND NEW.trial_ends_at IS NOT NULL AND NEW.trial_ends_at < NOW() THEN
    NEW.subscription_status = 'free';
    NEW.is_premium = false;
    NEW.subscription_tier = 'free';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update check_and_update_expired_trials function
CREATE OR REPLACE FUNCTION public.check_and_update_expired_trials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Check if any trials have expired and update them
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    is_premium = false,
    subscription_tier = 'free'
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at < NOW();
    
  RETURN NULL;
END;
$function$;