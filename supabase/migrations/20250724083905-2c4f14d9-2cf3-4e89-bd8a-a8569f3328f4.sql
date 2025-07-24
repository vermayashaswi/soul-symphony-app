-- Phase 2 (final batch): Fix remaining core function search paths

CREATE OR REPLACE FUNCTION public.insert_sample_journal_entries(target_user_id uuid)
 RETURNS TABLE(inserted_id bigint, inserted_created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  i INTEGER;
  random_timestamp TIMESTAMP WITH TIME ZONE;
  new_id BIGINT;
BEGIN
  -- Insert 10 entries with random timestamps from the last 3 months
  FOR i IN 1..10 LOOP
    -- Generate random timestamp within last 3 months
    random_timestamp := NOW() - (RANDOM() * INTERVAL '3 months');
    
    -- Insert the entry
    INSERT INTO "Journal Entries" (user_id, created_at)
    VALUES (target_user_id, random_timestamp)
    RETURNING id, created_at INTO new_id, random_timestamp;
    
    -- Return the inserted data
    inserted_id := new_id;
    inserted_created_at := random_timestamp;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enhanced_manage_user_session(p_user_id uuid, p_device_type text, p_user_agent text, p_entry_page text, p_last_active_page text, p_language text DEFAULT 'en'::text, p_referrer text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_country_code text DEFAULT NULL::text, p_currency text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_gclid text DEFAULT NULL::text, p_fbclid text DEFAULT NULL::text, p_attribution_data jsonb DEFAULT '{}'::jsonb, p_session_fingerprint text DEFAULT NULL::text, p_browser_info jsonb DEFAULT NULL::jsonb, p_device_fingerprint text DEFAULT NULL::text, p_platform text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  session_id UUID;
  computed_fingerprint TEXT;
BEGIN
  -- Generate session fingerprint if not provided
  IF p_session_fingerprint IS NULL THEN
    computed_fingerprint := encode(
      digest(
        COALESCE(p_user_agent, '') || 
        COALESCE(p_ip_address, '') || 
        COALESCE(p_device_fingerprint, '') ||
        COALESCE(p_platform, '') ||
        EXTRACT(EPOCH FROM NOW())::TEXT, -- Add timestamp for uniqueness
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

  -- Check if there's an active session with the same fingerprint (same device/browser)
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

CREATE OR REPLACE FUNCTION public.close_user_session(p_session_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = NOW(),
    session_duration = NOW() - session_start
  WHERE 
    id = p_session_id 
    AND user_id = p_user_id 
    AND is_active = true;
    
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_conversion_event(p_session_id uuid, p_event_type text, p_event_data jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  new_event JSONB;
BEGIN
  -- Create the event object
  new_event := jsonb_build_object(
    'type', p_event_type,
    'timestamp', NOW(),
    'data', p_event_data
  );
  
  -- Add the event to the session's conversion_events array
  UPDATE user_sessions
  SET 
    conversion_events = COALESCE(conversion_events, '[]'::jsonb) || new_event,
    last_activity = NOW()
  WHERE id = p_session_id;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Close expired sessions
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW()),
    session_duration = COALESCE(session_duration, NOW() - session_start)
  WHERE 
    is_active = true 
    AND session_timeout < NOW();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$function$;