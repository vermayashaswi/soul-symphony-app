-- Drop and recreate the function with correct signature
DROP FUNCTION IF EXISTS public.get_user_subscription_status(uuid);

-- Comprehensive Backend Optimization Migration - Part 1
-- 1. Optimize user subscription status function
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS TABLE(
  current_tier text,
  current_status text,
  trial_end_date timestamp with time zone,
  is_trial_active boolean,
  is_premium_access boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
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
  FROM public.profiles p
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
$$;

-- 2. Optimize trial eligibility check
CREATE OR REPLACE FUNCTION public.is_trial_eligible(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
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
$$;