-- Enhance user_sessions table with mobile-specific fields
ALTER TABLE public.user_sessions 
ADD COLUMN IF NOT EXISTS session_state text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS app_version text,
ADD COLUMN IF NOT EXISTS network_state text,
ADD COLUMN IF NOT EXISTS battery_level integer,
ADD COLUMN IF NOT EXISTS memory_usage bigint,
ADD COLUMN IF NOT EXISTS session_quality_score numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS inactivity_duration interval DEFAULT '0 seconds',
ADD COLUMN IF NOT EXISTS background_time interval DEFAULT '0 seconds',
ADD COLUMN IF NOT EXISTS foreground_time interval DEFAULT '0 seconds',
ADD COLUMN IF NOT EXISTS session_renewal_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_renewal_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS background_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS foreground_start_time timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS app_launch_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS crash_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_count integer DEFAULT 0;

-- Add check constraint for session_state
ALTER TABLE public.user_sessions 
ADD CONSTRAINT session_state_check 
CHECK (session_state IN ('active', 'background', 'inactive', 'terminated'));

-- Create index for better performance on session queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_state_activity 
ON public.user_sessions (user_id, session_state, last_activity);

CREATE INDEX IF NOT EXISTS idx_user_sessions_timeout 
ON public.user_sessions (session_timeout) 
WHERE is_active = true;

-- Create function to calculate session quality score
CREATE OR REPLACE FUNCTION public.calculate_session_quality_score(
  p_session_duration interval,
  p_page_views integer,
  p_crash_count integer,
  p_error_count integer,
  p_background_time interval,
  p_foreground_time interval
) RETURNS numeric
LANGUAGE plpgsql
AS $$
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
$$;

-- Create function to update session quality score
CREATE OR REPLACE FUNCTION public.update_session_quality_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

-- Create trigger to automatically update quality score
DROP TRIGGER IF EXISTS update_session_quality_trigger ON public.user_sessions;
CREATE TRIGGER update_session_quality_trigger
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_quality_score();

-- Enhanced session management function
CREATE OR REPLACE FUNCTION public.enhanced_session_manager(
  p_user_id uuid,
  p_action text, -- 'create', 'update', 'background', 'foreground', 'terminate'
  p_device_type text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_entry_page text DEFAULT NULL,
  p_last_active_page text DEFAULT NULL,
  p_session_fingerprint text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_network_state text DEFAULT NULL,
  p_battery_level integer DEFAULT NULL,
  p_memory_usage bigint DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_additional_data jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;