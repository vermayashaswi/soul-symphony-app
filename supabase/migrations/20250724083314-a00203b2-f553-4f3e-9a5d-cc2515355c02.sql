-- Phase 1: Clean up duplicate RLS policies on profiles table
-- First, remove all duplicate policies for profiles table

-- Drop all existing duplicate policies on profiles table
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.profiles;

-- Create single, consolidated RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Drop duplicate policies on revenuecat_customers table
DROP POLICY IF EXISTS "Users can insert their own RevenueCat customer data" ON public.revenuecat_customers;
DROP POLICY IF EXISTS "Users can update their own RevenueCat customer data" ON public.revenuecat_customers;
DROP POLICY IF EXISTS "Users can view their own RevenueCat customer data" ON public.revenuecat_customers;
DROP POLICY IF EXISTS "Users can update their own revenuecat customer data" ON public.revenuecat_customers;
DROP POLICY IF EXISTS "Users can view their own revenuecat customer data" ON public.revenuecat_customers;

-- Keep only the consolidated policy that already exists
-- "Users can view their own customer data" (which covers ALL operations)

-- Add security definer and proper search paths to critical functions to fix security warnings
CREATE OR REPLACE FUNCTION public.check_sms_rate_limit(p_phone_number text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  recent_attempts INTEGER;
  last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count attempts in last hour
  SELECT COUNT(*), MAX(created_at)
  INTO recent_attempts, last_attempt
  FROM public.phone_verifications
  WHERE phone_number = p_phone_number
    AND created_at > NOW() - INTERVAL '1 hour'
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Check if rate limited (max 5 SMS per hour per phone number)
  IF recent_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'rate_limited',
      'retry_after', EXTRACT(EPOCH FROM (last_attempt + INTERVAL '1 hour' - NOW()))
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_session_quality_score(p_session_duration interval, p_page_views integer, p_crash_count integer, p_error_count integer, p_background_time interval, p_foreground_time interval)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  quality_score numeric := 1.0;
  duration_minutes numeric;
  background_ratio numeric;
BEGIN
  -- Base score starts at 1.0
  
  -- Duration factor (longer sessions are better, up to a point)
  duration_minutes := EXTRACT(EPOCH FROM p_session_duration) / 60.0;
  IF duration_minutes > 0 THEN
    quality_score := quality_score + LEAST(duration_minutes / 30.0, 2.0); -- Max +2.0 for 30+ minutes
  END IF;
  
  -- Page views factor
  IF p_page_views > 1 THEN
    quality_score := quality_score + LEAST(p_page_views * 0.1, 1.0); -- Max +1.0 for 10+ page views
  END IF;
  
  -- Crash/error penalties
  quality_score := quality_score - (p_crash_count * 0.5) - (p_error_count * 0.1);
  
  -- Background time ratio (too much background time reduces quality)
  IF p_foreground_time > interval '0' THEN
    background_ratio := EXTRACT(EPOCH FROM p_background_time) / EXTRACT(EPOCH FROM p_foreground_time);
    IF background_ratio > 2.0 THEN -- More than 2:1 background:foreground ratio
      quality_score := quality_score - (background_ratio - 2.0) * 0.2;
    END IF;
  END IF;
  
  -- Ensure score is between 0 and 5
  RETURN GREATEST(0.0, LEAST(5.0, quality_score));
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_session_quality_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.session_quality_score := public.calculate_session_quality_score(
    COALESCE(NEW.session_duration, NOW() - NEW.session_start),
    NEW.page_views,
    NEW.crash_count,
    NEW.error_count,
    NEW.background_time,
    NEW.foreground_time
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enhanced_session_manager(p_user_id uuid, p_action text, p_device_type text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text, p_last_active_page text DEFAULT NULL::text, p_session_fingerprint text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_network_state text DEFAULT NULL::text, p_battery_level integer DEFAULT NULL::integer, p_memory_usage bigint DEFAULT NULL::bigint, p_platform text DEFAULT NULL::text, p_additional_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  session_id uuid;
  current_session RECORD;
  computed_fingerprint text;
BEGIN
  -- Generate or use provided session fingerprint
  computed_fingerprint := COALESCE(
    p_session_fingerprint,
    encode(digest(
      COALESCE(p_user_agent, '') || 
      COALESCE(p_device_type, '') || 
      COALESCE(p_platform, '') ||
      p_user_id::text ||
      EXTRACT(EPOCH FROM NOW())::text,
      'sha256'
    ), 'hex')
  );

  -- Find active session for this user/device
  SELECT * INTO current_session
  FROM user_sessions
  WHERE user_id = p_user_id 
    AND session_fingerprint = computed_fingerprint
    AND is_active = true
    AND session_timeout > NOW()
  ORDER BY last_activity DESC
  LIMIT 1;

  CASE p_action
    WHEN 'create' THEN
      -- Close any existing active sessions for this fingerprint
      UPDATE user_sessions 
      SET 
        is_active = false,
        session_state = 'terminated',
        session_end = NOW(),
        session_duration = NOW() - session_start
      WHERE user_id = p_user_id 
        AND session_fingerprint = computed_fingerprint
        AND is_active = true;
      
      -- Create new session
      INSERT INTO user_sessions (
        user_id, device_type, user_agent, entry_page, last_active_page,
        session_fingerprint, app_version, network_state, battery_level,
        memory_usage, platform, session_timeout, foreground_start_time
      ) VALUES (
        p_user_id, p_device_type, p_user_agent, p_entry_page, p_last_active_page,
        computed_fingerprint, p_app_version, p_network_state, p_battery_level,
        p_memory_usage, p_platform, NOW() + INTERVAL '24 hours', NOW()
      ) RETURNING id INTO session_id;
      
    WHEN 'update' THEN
      IF current_session.id IS NOT NULL THEN
        UPDATE user_sessions
        SET 
          last_activity = NOW(),
          last_active_page = COALESCE(p_last_active_page, last_active_page),
          page_views = page_views + 1,
          session_timeout = NOW() + INTERVAL '24 hours',
          network_state = COALESCE(p_network_state, network_state),
          battery_level = COALESCE(p_battery_level, battery_level),
          memory_usage = COALESCE(p_memory_usage, memory_usage)
        WHERE id = current_session.id;
        
        session_id := current_session.id;
      END IF;
      
    WHEN 'background' THEN
      IF current_session.id IS NOT NULL THEN
        UPDATE user_sessions
        SET 
          session_state = 'background',
          background_start_time = NOW(),
          foreground_time = COALESCE(foreground_time, interval '0') + 
                           COALESCE(NOW() - foreground_start_time, interval '0'),
          last_activity = NOW()
        WHERE id = current_session.id;
        
        session_id := current_session.id;
      END IF;
      
    WHEN 'foreground' THEN
      IF current_session.id IS NOT NULL THEN
        UPDATE user_sessions
        SET 
          session_state = 'active',
          foreground_start_time = NOW(),
          background_time = COALESCE(background_time, interval '0') + 
                           COALESCE(NOW() - background_start_time, interval '0'),
          app_launch_count = app_launch_count + 1,
          last_activity = NOW(),
          session_timeout = NOW() + INTERVAL '24 hours'
        WHERE id = current_session.id;
        
        session_id := current_session.id;
      END IF;
      
    WHEN 'terminate' THEN
      IF current_session.id IS NOT NULL THEN
        UPDATE user_sessions
        SET 
          is_active = false,
          session_state = 'terminated',
          session_end = NOW(),
          session_duration = NOW() - session_start,
          foreground_time = COALESCE(foreground_time, interval '0') + 
                           CASE 
                             WHEN session_state = 'active' 
                             THEN COALESCE(NOW() - foreground_start_time, interval '0')
                             ELSE interval '0'
                           END,
          background_time = COALESCE(background_time, interval '0') + 
                           CASE 
                             WHEN session_state = 'background' 
                             THEN COALESCE(NOW() - background_start_time, interval '0')
                             ELSE interval '0'
                           END
        WHERE id = current_session.id;
        
        session_id := current_session.id;
      END IF;
  END CASE;
  
  RETURN session_id;
END;
$function$;