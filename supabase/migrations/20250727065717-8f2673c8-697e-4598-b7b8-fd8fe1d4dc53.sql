-- Database cleanup: Remove complex session and rate limiting functions
-- This addresses the remaining revert plan items for database simplification

-- 1. Drop the enhanced_session_manager function (complex session tracking)
DROP FUNCTION IF EXISTS public.enhanced_session_manager(uuid, text, text, text, text, text, text, text, text, integer, bigint, text, jsonb);

-- 2. Drop the complex rate limiting functions
DROP FUNCTION IF EXISTS public.check_rate_limit(uuid, inet, text);
DROP FUNCTION IF EXISTS public.log_api_usage(uuid, inet, text, text, text, integer, integer, integer, numeric, boolean, text, text, text, integer, integer, text);

-- 3. Drop complex session quality and calculation functions
DROP FUNCTION IF EXISTS public.calculate_session_quality_score(interval, integer, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.update_session_quality_score();

-- 4. Drop complex conversion tracking functions
DROP FUNCTION IF EXISTS public.track_conversion_event(uuid, text, jsonb);

-- 5. Drop unused analytics and attribution functions
DROP FUNCTION IF EXISTS public.get_attribution_analytics(timestamp with time zone, timestamp with time zone);

-- 6. Drop complex database validation functions  
DROP FUNCTION IF EXISTS public.validate_phone_number(text);

-- 7. Drop security audit function (overly complex)
DROP FUNCTION IF EXISTS public.security_audit();

-- 8. Drop the execute_dynamic_query function (security risk)
DROP FUNCTION IF EXISTS public.execute_dynamic_query(text, text[]);

-- 9. Remove complex rate limiting and API usage tables that are no longer needed
DROP TABLE IF EXISTS public.api_usage CASCADE;
DROP TABLE IF EXISTS public.openai_usage CASCADE;

-- 10. Remove complex session tracking columns from user_sessions
-- Keep only the essential columns for simple session management
ALTER TABLE public.user_sessions 
DROP COLUMN IF EXISTS utm_source,
DROP COLUMN IF EXISTS utm_medium, 
DROP COLUMN IF EXISTS utm_campaign,
DROP COLUMN IF EXISTS utm_term,
DROP COLUMN IF EXISTS utm_content,
DROP COLUMN IF EXISTS gclid,
DROP COLUMN IF EXISTS fbclid,
DROP COLUMN IF EXISTS referrer,
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS currency,
DROP COLUMN IF EXISTS country_code,
DROP COLUMN IF EXISTS language;

-- 11. Fix function search paths for remaining functions to address linter warnings
-- This fixes the "Function Search Path Mutable" warnings

-- Update auto_start_trial function
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

-- Update simple_session_manager function
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

-- Update other essential functions with proper search paths
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Close expired sessions
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW())
  WHERE 
    is_active = true 
    AND last_activity < NOW() - INTERVAL '24 hours';
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  -- Update expired trials to free status
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
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', format('Updated %s expired trials to free status', updated_count)
  );
END;
$function$;

-- 12. Simplify RLS policies to require authentication instead of allowing anonymous access
-- Update policies to be more restrictive and require proper authentication

-- Update user_sessions policies
DROP POLICY IF EXISTS "Authenticated users can select user sessions" ON public.user_sessions;
CREATE POLICY "Users can view their own sessions only" ON public.user_sessions
FOR SELECT USING (auth.uid() = user_id);

-- Update feature_flags policy to require authentication  
DROP POLICY IF EXISTS "Anyone can view feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can view feature flags" ON public.feature_flags
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Update themes policy to require authentication
DROP POLICY IF EXISTS "Anyone can view active themes" ON public.themes;
CREATE POLICY "Authenticated users can view active themes" ON public.themes
FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Update emotions policy to require authentication  
DROP POLICY IF EXISTS "Allow read access to emotions for authenticated users" ON public.emotions;
CREATE POLICY "Authenticated users can view emotions" ON public.emotions
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add RLS policy for profiles_backup table (was missing)
ALTER TABLE public.profiles_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No access to backup table" ON public.profiles_backup
FOR ALL USING (false);