-- Drop existing function and recreate with correct signature
DROP FUNCTION IF EXISTS public.get_user_subscription_status(uuid);

-- Create get_user_subscription_status function with correct return type
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  user_profile RECORD;
  result jsonb;
  is_trial_active boolean := false;
BEGIN
  -- Get user profile with subscription data
  SELECT 
    subscription_status,
    subscription_tier,
    is_premium,
    trial_ends_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- If no profile found, return default values
  IF user_profile IS NULL THEN
    RETURN jsonb_build_object(
      'subscription_status', 'free',
      'subscription_tier', 'free',
      'is_premium', false,
      'trial_ends_at', null,
      'is_trial_active', false
    );
  END IF;
  
  -- Check if trial is still active
  IF user_profile.trial_ends_at IS NOT NULL THEN
    is_trial_active := user_profile.trial_ends_at > NOW();
  END IF;
  
  -- Build and return result
  result := jsonb_build_object(
    'subscription_status', COALESCE(user_profile.subscription_status, 'free'),
    'subscription_tier', COALESCE(user_profile.subscription_tier, 'free'),
    'is_premium', COALESCE(user_profile.is_premium, false),
    'trial_ends_at', user_profile.trial_ends_at,
    'is_trial_active', is_trial_active
  );
  
  RETURN result;
END;
$function$;

-- Create is_trial_eligible function
CREATE OR REPLACE FUNCTION public.is_trial_eligible(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get user profile
  SELECT 
    subscription_status,
    trial_ends_at,
    created_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- If no profile found, not eligible
  IF user_profile IS NULL THEN
    RETURN false;
  END IF;
  
  -- User is eligible for trial if:
  -- 1. They have never had a trial (trial_ends_at is null)
  -- 2. Their current status is 'free'
  RETURN (
    user_profile.trial_ends_at IS NULL AND
    COALESCE(user_profile.subscription_status, 'free') = 'free'
  );
END;
$function$;

-- Create cleanup_expired_trials function
CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  updated_count integer;
BEGIN
  -- Update expired trials to free status
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
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', format('Updated %s expired trials to free status', updated_count)
  );
END;
$function$;