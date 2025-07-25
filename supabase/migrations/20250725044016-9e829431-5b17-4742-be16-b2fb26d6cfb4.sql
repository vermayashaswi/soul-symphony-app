-- STEP 1: Fix Auto-Trial Trigger Logic
-- Update the auto_start_trial trigger to be compatible with frontend expectations
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'free'; -- Keep tier as 'free' during trial
    NEW.is_premium = true; -- Grant premium access during trial
  END IF;
  
  RETURN NEW;
END;
$function$;

-- STEP 2: Fix Database Function Security
-- Update get_user_subscription_status with proper security
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  result jsonb;
  is_trial_active boolean := false;
  auth_context_user_id uuid;
BEGIN
  -- Get auth context
  SELECT auth.uid() INTO auth_context_user_id;
  
  -- Verify auth context matches parameter
  IF auth_context_user_id != user_id_param THEN
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

-- STEP 3: Simplify Session Management
-- Update enhanced_manage_user_session with better security and performance
CREATE OR REPLACE FUNCTION public.enhanced_manage_user_session(
  p_user_id uuid, 
  p_device_type text, 
  p_user_agent text, 
  p_entry_page text, 
  p_last_active_page text, 
  p_language text DEFAULT 'en'::text,
  p_referrer text DEFAULT NULL::text,
  p_ip_address text DEFAULT NULL::text,
  p_country_code text DEFAULT NULL::text,
  p_currency text DEFAULT NULL::text,
  p_utm_source text DEFAULT NULL::text,
  p_utm_medium text DEFAULT NULL::text,
  p_utm_campaign text DEFAULT NULL::text,
  p_utm_term text DEFAULT NULL::text,
  p_utm_content text DEFAULT NULL::text,
  p_gclid text DEFAULT NULL::text,
  p_fbclid text DEFAULT NULL::text,
  p_attribution_data jsonb DEFAULT '{}'::jsonb,
  p_session_fingerprint text DEFAULT NULL::text,
  p_browser_info jsonb DEFAULT NULL::jsonb,
  p_device_fingerprint text DEFAULT NULL::text,
  p_platform text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_id UUID;
  computed_fingerprint TEXT;
BEGIN
  -- Verify user authentication
  IF auth.uid() != p_user_id THEN
    RETURN NULL;
  END IF;

  -- Generate session fingerprint if not provided
  IF p_session_fingerprint IS NULL THEN
    computed_fingerprint := encode(
      digest(
        COALESCE(p_user_agent, '') || 
        COALESCE(p_ip_address, '') || 
        COALESCE(p_device_fingerprint, '') ||
        COALESCE(p_platform, '') ||
        EXTRACT(EPOCH FROM NOW())::TEXT,
        'sha256'
      ), 
      'hex'
    );
  ELSE
    computed_fingerprint := p_session_fingerprint;
  END IF;

  -- First, expire old sessions that have timed out
  UPDATE user_sessions 
  SET 
    is_active = false,
    session_end = NOW(),
    session_duration = NOW() - session_start
  WHERE 
    user_id = p_user_id 
    AND is_active = true 
    AND session_timeout < NOW();

  -- Check if there's an active session with the same fingerprint
  SELECT id INTO session_id
  FROM user_sessions
  WHERE 
    user_id = p_user_id 
    AND session_fingerprint = computed_fingerprint
    AND is_active = true
    AND session_timeout > NOW()
  LIMIT 1;

  IF session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE user_sessions
    SET 
      last_activity = NOW(),
      last_active_page = p_last_active_page,
      page_views = page_views + 1,
      session_timeout = NOW() + INTERVAL '24 hours'
    WHERE id = session_id;
    
    RETURN session_id;
  ELSE
    -- Create new session
    INSERT INTO user_sessions (
      user_id, device_type, user_agent, entry_page, last_active_page,
      language, referrer, ip_address, country_code, currency,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      gclid, fbclid, attribution_data, session_fingerprint,
      browser_info, device_fingerprint, platform, session_timeout
    ) VALUES (
      p_user_id, p_device_type, p_user_agent, p_entry_page, p_last_active_page,
      p_language, p_referrer, p_ip_address, p_country_code, p_currency,
      p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
      p_gclid, p_fbclid, p_attribution_data, computed_fingerprint,
      COALESCE(p_browser_info, '{}'), p_device_fingerprint, p_platform, NOW() + INTERVAL '24 hours'
    ) RETURNING id INTO session_id;
    
    RETURN session_id;
  END IF;
END;
$function$;

-- STEP 4: Update existing trial users that might have incorrect tier
UPDATE public.profiles 
SET 
  subscription_tier = 'free', -- Set to 'free' during trial for frontend compatibility
  updated_at = NOW()
WHERE 
  subscription_status = 'trial' 
  AND is_premium = true 
  AND subscription_tier = 'premium';

-- STEP 5: Clean up expired trials to ensure consistency
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