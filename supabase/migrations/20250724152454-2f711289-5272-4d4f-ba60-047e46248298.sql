-- Revert Google Sign-In Related Security Changes

-- 1. Drop consolidated RLS policies and restore original ones for profiles table
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Restore original profiles policies
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles  
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- 2. Drop consolidated RLS policies and restore original ones for revenuecat_customers table
DROP POLICY IF EXISTS "Users can insert their own revenuecat customer data" ON public.revenuecat_customers;
DROP POLICY IF EXISTS "Users can view their own customer data" ON public.revenuecat_customers;

-- Restore original revenuecat_customers policies
CREATE POLICY "Users can insert their own revenuecat customer data" ON public.revenuecat_customers
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own customer data" ON public.revenuecat_customers
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Remove SECURITY DEFINER and SET search_path from functions that still have them

-- Revert check_sms_rate_limit function
CREATE OR REPLACE FUNCTION public.check_sms_rate_limit(p_phone_number text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
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

-- Revert calculate_session_quality_score function
CREATE OR REPLACE FUNCTION public.calculate_session_quality_score(p_session_duration interval, p_page_views integer, p_crash_count integer, p_error_count integer, p_background_time interval, p_foreground_time interval)
RETURNS numeric
LANGUAGE plpgsql
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

-- Revert update_session_quality_score function
CREATE OR REPLACE FUNCTION public.update_session_quality_score()
RETURNS trigger
LANGUAGE plpgsql
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

-- Revert enhanced_session_manager function
CREATE OR REPLACE FUNCTION public.enhanced_session_manager(p_user_id uuid, p_action text, p_device_type text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text, p_last_active_page text DEFAULT NULL::text, p_session_fingerprint text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_network_state text DEFAULT NULL::text, p_battery_level integer DEFAULT NULL::integer, p_memory_usage bigint DEFAULT NULL::bigint, p_platform text DEFAULT NULL::text, p_additional_data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
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

-- Revert enhanced_manage_user_session function
CREATE OR REPLACE FUNCTION public.enhanced_manage_user_session(p_user_id uuid, p_device_type text, p_user_agent text, p_entry_page text, p_last_active_page text, p_language text DEFAULT 'en'::text, p_referrer text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_country_code text DEFAULT NULL::text, p_currency text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_gclid text DEFAULT NULL::text, p_fbclid text DEFAULT NULL::text, p_attribution_data jsonb DEFAULT '{}'::jsonb, p_session_fingerprint text DEFAULT NULL::text, p_browser_info jsonb DEFAULT NULL::jsonb, p_device_fingerprint text DEFAULT NULL::text, p_platform text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
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

-- Revert close_user_session function
CREATE OR REPLACE FUNCTION public.close_user_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
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

-- Revert track_conversion_event function
CREATE OR REPLACE FUNCTION public.track_conversion_event(p_session_id uuid, p_event_type text, p_event_data jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
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

-- Revert cleanup_expired_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
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

-- Revert update_user_sessions_updated_at function
CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$function$;

-- Revert upsert_journal_embedding function
CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO journal_embeddings (journal_entry_id, content, embedding)
  SELECT 
    entry_id,
    COALESCE(je."refined text", je."transcription text", '') as content,
    embedding_vector
  FROM "Journal Entries" je
  WHERE je.id = entry_id
  ON CONFLICT (journal_entry_id) 
  DO UPDATE SET 
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content;
END;
$function$;

-- Revert regenerate_missing_data_for_entry function
CREATE OR REPLACE FUNCTION public.regenerate_missing_data_for_entry(target_entry_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  entry_record RECORD;
  result jsonb := '{}';
BEGIN
  -- Get the entry details
  SELECT id, "refined text", "transcription text", user_id, sentiment, themes, master_themes, entities, emotions
  INTO entry_record
  FROM "Journal Entries"
  WHERE id = target_entry_id;
  
  IF entry_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Entry not found');
  END IF;
  
  -- Clear existing data that needs to be regenerated
  UPDATE "Journal Entries"
  SET 
    themes = NULL,
    master_themes = NULL,
    themeemotion = NULL,
    entities = NULL,
    emotions = NULL,
    sentiment = '0'
  WHERE id = target_entry_id;
  
  -- Delete existing embedding to force regeneration
  DELETE FROM journal_embeddings WHERE journal_entry_id = target_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', target_entry_id,
    'message', 'Entry data cleared for regeneration'
  );
END;
$function$;

-- Revert delete_all_user_journal_entries function
CREATE OR REPLACE FUNCTION public.delete_all_user_journal_entries(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  deleted_count integer;
  embedding_count integer;
BEGIN
  -- Ensure the user is authenticated and can only delete their own entries
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Delete embeddings first (due to foreign key relationships)
  DELETE FROM journal_embeddings 
  WHERE journal_entry_id IN (
    SELECT id FROM "Journal Entries" 
    WHERE user_id = p_user_id
  );
  
  GET DIAGNOSTICS embedding_count = ROW_COUNT;

  -- Delete all journal entries for the user
  DELETE FROM "Journal Entries" 
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_entries', deleted_count,
    'deleted_embeddings', embedding_count
  );
END;
$function$;

-- Revert get_top_emotions_with_entries function
CREATE OR REPLACE FUNCTION public.get_top_emotions_with_entries(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric, sample_entries jsonb)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score,
      entries.id,
      COALESCE(entries."refined text", entries."transcription text") as content,
      entries.created_at
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    WHERE 
      entries.user_id = user_id_param
      AND entries.emotions IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  top_entries_per_emotion AS (
    SELECT
      emotion_name,
      id,
      content,
      created_at,
      emotion_score,
      ROW_NUMBER() OVER (PARTITION BY emotion_name ORDER BY emotion_score DESC) as rank
    FROM
      emotion_data
  ),
  sample_entries AS (
    SELECT
      emotion_name,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'content', left(content, 150),
          'created_at', created_at,
          'score', emotion_score
        )
      ) as entries_json
    FROM
      top_entries_per_emotion
    WHERE
      rank <= 2
    GROUP BY
      emotion_name
  ),
  aggregated_emotions AS (
    SELECT
      emotion_name as emotion,
      AVG(emotion_score) as avg_score,
      COUNT(*) as occurrence_count
    FROM
      emotion_data
    GROUP BY
      emotion_name
    ORDER BY
      avg_score DESC,
      occurrence_count DESC
    LIMIT limit_count
  )
  SELECT 
    ae.emotion,
    ROUND(ae.avg_score::numeric, 2) as score,
    COALESCE(se.entries_json, '[]'::jsonb) as sample_entries
  FROM 
    aggregated_emotions ae
  LEFT JOIN
    sample_entries se ON ae.emotion = se.emotion_name;
END;
$function$;

-- Revert check_table_columns function
CREATE OR REPLACE FUNCTION public.check_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  AND c.table_name = $1
  ORDER BY c.ordinal_position;
END;
$function$;