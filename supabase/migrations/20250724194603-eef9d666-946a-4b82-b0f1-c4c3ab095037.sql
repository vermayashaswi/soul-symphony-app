-- Add enhanced debugging to the get_user_subscription_status function
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_profile RECORD;
  result jsonb;
  is_trial_active boolean := false;
  auth_context_user_id uuid;
BEGIN
  -- Debug: Check auth context
  SELECT auth.uid() INTO auth_context_user_id;
  
  RAISE NOTICE 'get_user_subscription_status called - Param: %, Auth context: %', user_id_param, auth_context_user_id;
  
  -- Verify auth context matches parameter
  IF auth_context_user_id != user_id_param THEN
    RAISE NOTICE 'Auth context mismatch - Expected: %, Got: %', user_id_param, auth_context_user_id;
    RETURN jsonb_build_object(
      'error', 'Authentication mismatch',
      'subscription_status', 'free',
      'subscription_tier', 'free',
      'is_premium', false,
      'trial_ends_at', null,
      'is_trial_active', false
    );
  END IF;
  
  -- Get user profile with subscription data
  SELECT 
    subscription_status,
    subscription_tier,
    is_premium,
    trial_ends_at,
    created_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- Enhanced logging
  RAISE NOTICE 'Profile found: %, Status: %, Tier: %, Premium: %, Trial ends: %', 
    user_profile IS NOT NULL,
    user_profile.subscription_status,
    user_profile.subscription_tier,
    user_profile.is_premium,
    user_profile.trial_ends_at;
  
  -- If no profile found, return default values
  IF user_profile IS NULL THEN
    RAISE NOTICE 'No profile found for user %', user_id_param;
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
    RAISE NOTICE 'Trial check - Ends at: %, Now: %, Active: %', 
      user_profile.trial_ends_at, NOW(), is_trial_active;
  END IF;
  
  -- Build and return result
  result := jsonb_build_object(
    'subscription_status', COALESCE(user_profile.subscription_status, 'free'),
    'subscription_tier', COALESCE(user_profile.subscription_tier, 'free'),
    'is_premium', COALESCE(user_profile.is_premium, false),
    'trial_ends_at', user_profile.trial_ends_at,
    'is_trial_active', is_trial_active
  );
  
  RAISE NOTICE 'Returning result: %', result;
  RETURN result;
END;
$function$;