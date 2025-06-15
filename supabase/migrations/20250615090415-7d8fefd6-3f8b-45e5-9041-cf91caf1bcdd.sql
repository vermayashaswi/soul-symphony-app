
-- Drop the existing function that has a conflicting return type
DROP FUNCTION IF EXISTS get_attribution_analytics(timestamp with time zone, timestamp with time zone);

-- First, let's update the feature_flags table to have the correct structure
ALTER TABLE feature_flags 
ADD COLUMN IF NOT EXISTS key text,
ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS target_type text DEFAULT 'global',
ADD COLUMN IF NOT EXISTS target_value text;

-- Update existing columns if needed
ALTER TABLE feature_flags 
ALTER COLUMN enabled SET DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_target ON feature_flags(target_type, target_value);

-- Insert some default feature flags for testing
INSERT INTO feature_flags (key, name, description, enabled, target_type, target_value) 
VALUES 
  ('advanced_insights', 'Advanced Insights', 'Enable advanced insights features', true, 'global', null),
  ('beta_chat', 'Beta Chat Features', 'Enable beta chat functionality', false, 'tier', 'premium'),
  ('experimental_ui', 'Experimental UI', 'Enable experimental UI features', false, 'global', null)
ON CONFLICT DO NOTHING;

-- Create or update the enhanced session management function
CREATE OR REPLACE FUNCTION enhanced_manage_user_session(
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
  p_attribution_data JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id UUID;
  existing_session_id UUID;
BEGIN
  -- Check for existing active session
  SELECT id INTO existing_session_id
  FROM user_sessions
  WHERE user_id = p_user_id 
    AND is_active = true
    AND last_activity > NOW() - INTERVAL '30 minutes'
  ORDER BY last_activity DESC
  LIMIT 1;

  IF existing_session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE user_sessions
    SET 
      last_activity = NOW(),
      last_active_page = p_last_active_page,
      page_views = page_views + 1
    WHERE id = existing_session_id;
    
    RETURN existing_session_id;
  ELSE
    -- Create new session
    INSERT INTO user_sessions (
      user_id, device_type, user_agent, entry_page, last_active_page,
      language, referrer, ip_address, country_code, currency,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      gclid, fbclid, attribution_data
    ) VALUES (
      p_user_id, p_device_type, p_user_agent, p_entry_page, p_last_active_page,
      p_language, p_referrer, p_ip_address, p_country_code, p_currency,
      p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
      p_gclid, p_fbclid, p_attribution_data
    ) RETURNING id INTO session_id;
    
    RETURN session_id;
  END IF;
END;
$$;

-- Create conversion tracking function
CREATE OR REPLACE FUNCTION track_conversion_event(
  p_session_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions
  SET 
    conversion_events = conversion_events || jsonb_build_array(
      jsonb_build_object(
        'event_type', p_event_type,
        'event_data', p_event_data,
        'timestamp', NOW()
      )
    ),
    last_activity = NOW()
  WHERE id = p_session_id;
END;
$$;

-- Create analytics function with correct return type
CREATE OR REPLACE FUNCTION get_attribution_analytics(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH session_stats AS (
    SELECT 
      utm_source,
      utm_medium,
      utm_campaign,
      country_code,
      COUNT(*) as session_count,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(page_views) as avg_page_views,
      jsonb_array_length(conversion_events) as total_conversions
    FROM user_sessions
    WHERE 
      (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY utm_source, utm_medium, utm_campaign, country_code
  )
  SELECT jsonb_agg(row_to_json(session_stats)) INTO result
  FROM session_stats;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
