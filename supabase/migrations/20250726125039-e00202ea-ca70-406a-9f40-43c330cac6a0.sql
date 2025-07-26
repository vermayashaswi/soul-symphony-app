-- Comprehensive Backend Optimization Migration
-- This migration optimizes database functions for improved performance and reduces infinite loading issues

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
    
  -- Log the cleanup
  INSERT INTO public.api_usage (
    function_name,
    status_code,
    response_time_ms,
    created_at
  ) VALUES (
    'cleanup_expired_trials',
    200,
    0,
    NOW()
  );
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
    -- Log error and return failure
    INSERT INTO public.api_usage (
      function_name,
      error_message,
      status_code,
      created_at
    ) VALUES (
      'create_user_profile_optimized',
      SQLERRM,
      500,
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 5. Create optimized journal entries query function
CREATE OR REPLACE FUNCTION public.get_user_journal_entries_optimized(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint,
  content text,
  created_at timestamp with time zone,
  emotions jsonb,
  themes text[],
  master_themes text[],
  sentiment text,
  audio_url text,
  duration numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    je.id,
    COALESCE(je."refined text", je."transcription text", '') as content,
    je.created_at,
    je.emotions,
    je.themes,
    je.master_themes,
    je.sentiment,
    je.audio_url,
    je.duration
  FROM "Journal Entries" je
  WHERE je.user_id = p_user_id
  ORDER BY je.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 6. Create session management optimization function
CREATE OR REPLACE FUNCTION public.optimize_user_session(
  p_user_id uuid,
  p_session_fingerprint text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_id uuid;
  existing_session RECORD;
BEGIN
  -- Check for existing active session
  SELECT id, last_activity
  INTO existing_session
  FROM user_sessions
  WHERE user_id = p_user_id
    AND session_fingerprint = p_session_fingerprint
    AND is_active = true
    AND session_timeout > NOW()
  ORDER BY last_activity DESC
  LIMIT 1;
  
  IF existing_session.id IS NOT NULL THEN
    -- Update existing session
    UPDATE user_sessions
    SET 
      last_activity = NOW(),
      session_timeout = NOW() + INTERVAL '24 hours'
    WHERE id = existing_session.id;
    
    RETURN existing_session.id;
  ELSE
    -- Create new session
    INSERT INTO user_sessions (
      user_id,
      session_fingerprint,
      session_start,
      last_activity,
      session_timeout,
      is_active,
      page_views,
      session_state
    ) VALUES (
      p_user_id,
      p_session_fingerprint,
      NOW(),
      NOW(),
      NOW() + INTERVAL '24 hours',
      true,
      1,
      'active'
    ) RETURNING id INTO session_id;
    
    RETURN session_id;
  END IF;
END;
$$;

-- 7. Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_subscription_status 
ON public.profiles(subscription_status) 
WHERE subscription_status IN ('trial', 'active');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_trial_ends_at 
ON public.profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_user_created 
ON "Journal Entries"(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_active 
ON user_sessions(user_id, is_active, session_timeout) 
WHERE is_active = true;

-- 8. Update trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_optimized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only process INSERT operations for new profiles
  IF TG_OP = 'INSERT' THEN
    -- Set optimized trial defaults
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium';
    NEW.is_premium = true;
    NEW.onboarding_completed = COALESCE(NEW.onboarding_completed, false);
    
    -- Ensure timestamps are set
    IF NEW.created_at IS NULL THEN
      NEW.created_at = NOW();
    END IF;
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_optimized();