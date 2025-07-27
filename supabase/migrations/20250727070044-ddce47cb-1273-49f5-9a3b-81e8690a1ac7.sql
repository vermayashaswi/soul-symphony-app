-- Fix remaining function search paths and simplify RLS policies
-- This addresses the remaining linter warnings

-- Fix function search paths for remaining functions
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

CREATE OR REPLACE FUNCTION public.set_default_translation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.translation_status = 'completed';
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$function$;

-- Update all remaining functions with proper search paths
CREATE OR REPLACE FUNCTION public.check_trial_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.setup_user_trial_fallback(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Update all remaining journal and embedding functions
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

-- Fix RLS policies to require authentication and remove anonymous access
-- Update user_sessions policies
DROP POLICY IF EXISTS "Users can view their own sessions only" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;

CREATE POLICY "Users can view their own sessions" ON public.user_sessions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update feature_flags policy to require authentication  
DROP POLICY IF EXISTS "Authenticated users can view feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can view feature flags" ON public.feature_flags
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Update themes policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view active themes" ON public.themes;
CREATE POLICY "Authenticated users can view active themes" ON public.themes
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND is_active = true);

-- Update emotions policy to require authentication  
DROP POLICY IF EXISTS "Authenticated users can view emotions" ON public.emotions;
CREATE POLICY "Authenticated users can view emotions" ON public.emotions
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Update Journal Entries policies
DROP POLICY IF EXISTS "Users can view own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can update own journal entries" ON public."Journal Entries";
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public."Journal Entries";

CREATE POLICY "Users can view own journal entries" ON public."Journal Entries"
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries" ON public."Journal Entries"
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries" ON public."Journal Entries"
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries" ON public."Journal Entries"
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Add RLS policy for profiles_backup table (was missing)
CREATE POLICY "No access to backup table" ON public.profiles_backup
FOR ALL TO authenticated USING (false);