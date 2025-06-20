
-- Drop the existing function that's causing the conflict
DROP FUNCTION IF EXISTS public.track_conversion_event(uuid, text, jsonb);

-- First, let's update the user_sessions table structure to support proper session management
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS session_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS session_timeout TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
ADD COLUMN IF NOT EXISTS browser_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create index for better performance on session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_fingerprint 
ON user_sessions(user_id, session_fingerprint, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_sessions_timeout 
ON user_sessions(session_timeout) 
WHERE is_active = true;

-- Drop the old has_active_session function that was blocking new sessions
DROP FUNCTION IF EXISTS public.has_active_session(uuid);

-- Create new enhanced session management function
CREATE OR REPLACE FUNCTION public.enhanced_manage_user_session(
  p_user_id UUID,
  p_device_type TEXT,
  p_user_agent TEXT,
  p_entry_page TEXT,
  p_last_active_page TEXT,
  p_language TEXT DEFAULT 'en',
  p_referrer TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL,
  p_gclid TEXT DEFAULT NULL,
  p_fbclid TEXT DEFAULT NULL,
  p_attribution_data JSONB DEFAULT '{}',
  p_session_fingerprint TEXT DEFAULT NULL,
  p_browser_info JSONB DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create function to properly close sessions
CREATE OR REPLACE FUNCTION public.close_user_session(
  p_session_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create function to track conversion events within sessions
CREATE OR REPLACE FUNCTION public.track_conversion_event(
  p_session_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create function to cleanup expired sessions (to be run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_user_sessions_updated_at_trigger ON user_sessions;
CREATE TRIGGER update_user_sessions_updated_at_trigger
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();
