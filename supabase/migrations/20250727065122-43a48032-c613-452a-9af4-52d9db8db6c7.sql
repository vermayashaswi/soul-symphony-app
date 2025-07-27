-- =============================================================================
-- COMPLETE REMAINING SIMPLIFICATION AND FIX RLS POLICIES
-- =============================================================================

-- 1. SIMPLIFY CORE FUNCTIONS - Remove references to phone verification
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

-- 2. SIMPLIFY COMPREHENSIVE CLEANUP FUNCTION
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

-- 3. CREATE SIMPLE SESSION MANAGEMENT
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

-- 4. FIX RLS POLICIES FOR AUTHENTICATED USERS ONLY
-- Ensure all policies require authentication and don't allow anonymous access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix Journal Entries policies for authenticated users only
DROP POLICY IF EXISTS "Users can view own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can update own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public."Journal Entries";

CREATE POLICY "Users can view own journal entries" 
  ON public."Journal Entries" FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries" 
  ON public."Journal Entries" FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries" 
  ON public."Journal Entries" FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries" 
  ON public."Journal Entries" FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. ENSURE AUTO_START_TRIAL FUNCTION IS WORKING CORRECTLY
-- Update the existing auto_start_trial function to ensure it fixes the database fixes SQL issue
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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