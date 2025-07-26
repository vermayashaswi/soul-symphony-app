-- Comprehensive Backend Optimization Migration - Part 2
-- Continue with remaining optimizations

-- 3. Optimize expired trial cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only update trials that are actually expired and still marked as trial
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    subscription_tier = 'free',
    is_premium = false,
    updated_at = NOW()
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND is_premium = true; -- Only update if currently premium
END;
$$;

-- 4. Create optimized profile creation function
CREATE OR REPLACE FUNCTION public.create_user_profile_optimized(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
  existing_profile RECORD;
BEGIN
  -- Check if profile already exists
  SELECT id, subscription_status, is_premium 
  INTO existing_profile
  FROM public.profiles 
  WHERE id = p_user_id;
  
  IF existing_profile.id IS NOT NULL THEN
    -- Profile exists, return success
    RETURN jsonb_build_object(
      'success', true,
      'action', 'profile_exists',
      'profile_id', existing_profile.id
    );
  END IF;
  
  -- Create new profile with optimized defaults
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    subscription_status,
    subscription_tier,
    is_premium,
    trial_ends_at,
    onboarding_completed,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    p_full_name,
    p_avatar_url,
    'trial',
    'premium',
    true,
    NOW() + INTERVAL '14 days',
    false,
    NOW(),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'profile_created',
    'profile_id', p_user_id,
    'trial_ends_at', NOW() + INTERVAL '14 days'
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Profile was created concurrently, return success
    RETURN jsonb_build_object(
      'success', true,
      'action', 'profile_exists_concurrent',
      'profile_id', p_user_id
    );
  WHEN OTHERS THEN
    -- Return failure with error details
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;