-- ============================================================================
-- DROP EXISTING FUNCTIONS TO PREVENT CONFLICTS
-- ============================================================================

-- Drop existing functions that might have parameter conflicts
DROP FUNCTION IF EXISTS public.debug_user_auth(uuid);
DROP FUNCTION IF EXISTS public.test_auth_flow(uuid);
DROP FUNCTION IF EXISTS public.reset_user_auth(uuid);

-- ============================================================================
-- COMPREHENSIVE AUTH FLOW DATABASE FIXES
-- ============================================================================

-- Drop existing trigger and function to recreate properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Enhanced handle_new_user function with comprehensive profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  profile_exists boolean := false;
  user_email text;
  user_name text;
  avatar_url text;
  error_context text;
BEGIN
  -- Log the trigger execution
  RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
  
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO profile_exists;
  
  IF profile_exists THEN
    RAISE LOG 'Profile already exists for user: %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Extract user data safely
  user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(user_email, '@', 1)
  );
  avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  
  -- Create comprehensive user profile
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      display_name,
      avatar_url,
      subscription_status,
      subscription_tier,
      is_premium,
      trial_ends_at,
      onboarding_completed,
      tutorial_completed,
      tutorial_step,
      timezone,
      reminder_settings,
      journal_focus_areas,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      user_email,
      user_name,
      user_name,
      avatar_url,
      'trial',
      'premium',
      true,
      NOW() + INTERVAL '14 days',
      false,
      'NO',
      0,
      'UTC',
      '{"morning": true, "evening": true, "morningTime": "08:00", "eveningTime": "21:00"}'::jsonb,
      '{}'::text[],
      NOW(),
      NOW()
    );
    
    RAISE LOG 'Successfully created profile for user: %', NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    error_context := format('Failed to create profile for user %s: %s', NEW.id, SQLERRM);
    RAISE LOG '%', error_context;
    
    -- Don't block user creation, just log the error
    RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Create the trigger for both INSERT and UPDATE
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- AUTH ERROR LOGGING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  error_type text NOT NULL,
  error_message text NOT NULL,
  context text,
  resolved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Enable RLS on auth_errors
ALTER TABLE public.auth_errors ENABLE ROW LEVEL SECURITY;

-- RLS policies for auth_errors
CREATE POLICY "Users can view their own auth errors"
  ON public.auth_errors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert auth errors"
  ON public.auth_errors FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- FIX USER SESSIONS RLS POLICIES
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;

-- Create corrected RLS policies for user_sessions
CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions"
  ON public.user_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- COMPREHENSIVE TEST FUNCTIONS
-- ============================================================================

-- Test auth flow function
CREATE OR REPLACE FUNCTION public.test_auth_flow(test_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  profile_exists boolean := false;
  session_exists boolean := false;
  auth_errors_count integer := 0;
  result jsonb;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = test_user_id) INTO profile_exists;
  
  -- Check if active session exists
  SELECT EXISTS(
    SELECT 1 FROM user_sessions 
    WHERE user_id = test_user_id AND is_active = true
  ) INTO session_exists;
  
  -- Count auth errors
  SELECT COUNT(*) FROM auth_errors WHERE user_id = test_user_id INTO auth_errors_count;
  
  result := jsonb_build_object(
    'user_id', test_user_id,
    'profile_exists', profile_exists,
    'session_exists', session_exists,
    'auth_errors_count', auth_errors_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- Reset user auth function
CREATE OR REPLACE FUNCTION public.reset_user_auth(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_profiles integer := 0;
  deleted_sessions integer := 0;
  deleted_errors integer := 0;
BEGIN
  -- Ensure only the user can reset their own auth or admin
  IF target_user_id != auth.uid() AND auth.role() != 'service_role' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Delete user sessions
  DELETE FROM user_sessions WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;
  
  -- Delete auth errors
  DELETE FROM auth_errors WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_errors = ROW_COUNT;
  
  -- Delete profile (will trigger cascade)
  DELETE FROM profiles WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_profiles = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_profiles', deleted_profiles,
    'deleted_sessions', deleted_sessions,
    'deleted_errors', deleted_errors,
    'timestamp', NOW()
  );
END;
$$;

-- Debug user auth function
CREATE OR REPLACE FUNCTION public.debug_user_auth(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  profile_data jsonb;
  session_data jsonb;
  error_data jsonb;
  auth_user_data jsonb;
  result jsonb;
BEGIN
  -- Get profile data
  SELECT to_jsonb(p.*) FROM profiles p WHERE id = target_user_id INTO profile_data;
  
  -- Get session data
  SELECT jsonb_agg(to_jsonb(s.*)) FROM user_sessions s WHERE user_id = target_user_id INTO session_data;
  
  -- Get error data
  SELECT jsonb_agg(to_jsonb(e.*)) FROM auth_errors e WHERE user_id = target_user_id INTO error_data;
  
  -- Get auth.users data (limited fields for security)
  SELECT jsonb_build_object(
    'id', au.id,
    'email', au.email,
    'created_at', au.created_at,
    'updated_at', au.updated_at,
    'email_confirmed_at', au.email_confirmed_at,
    'last_sign_in_at', au.last_sign_in_at
  ) FROM auth.users au WHERE id = target_user_id INTO auth_user_data;
  
  result := jsonb_build_object(
    'user_id', target_user_id,
    'auth_user', COALESCE(auth_user_data, 'null'::jsonb),
    'profile', COALESCE(profile_data, 'null'::jsonb),
    'sessions', COALESCE(session_data, '[]'::jsonb),
    'errors', COALESCE(error_data, '[]'::jsonb),
    'debug_timestamp', NOW()
  );
  
  RETURN result;
END;
$$;