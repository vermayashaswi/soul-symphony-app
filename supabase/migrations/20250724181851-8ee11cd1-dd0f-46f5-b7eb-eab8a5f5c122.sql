-- Performance Optimization: Add essential database maintenance functions

-- Add automatic cleanup function that can be called periodically
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

-- Add comprehensive maintenance function
CREATE OR REPLACE FUNCTION public.perform_database_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  expired_trials integer;
  expired_sessions integer;
  cleanup_result jsonb;
  maintenance_result jsonb;
BEGIN
  -- Clean up expired trials
  SELECT jsonb_extract_path_text(public.cleanup_expired_trials(), 'updated_count')::integer INTO expired_trials;
  
  -- Clean up expired sessions
  SELECT public.cleanup_expired_sessions() INTO expired_sessions;
  
  -- Build result
  maintenance_result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'expired_trials_cleaned', COALESCE(expired_trials, 0),
    'expired_sessions_cleaned', COALESCE(expired_sessions, 0),
    'message', 'Database maintenance completed successfully'
  );
  
  RETURN maintenance_result;
END;
$function$;

-- Add function to check database health
CREATE OR REPLACE FUNCTION public.check_database_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  total_entries integer;
  total_embeddings integer;
  missing_embeddings integer;
  active_users integer;
  health_status jsonb;
BEGIN
  -- Count total journal entries
  SELECT COUNT(*) INTO total_entries FROM "Journal Entries";
  
  -- Count total embeddings
  SELECT COUNT(*) INTO total_embeddings FROM journal_embeddings;
  
  -- Count entries missing embeddings
  SELECT COUNT(*) INTO missing_embeddings
  FROM "Journal Entries" je
  LEFT JOIN journal_embeddings emb ON je.id = emb.journal_entry_id
  WHERE emb.journal_entry_id IS NULL;
  
  -- Count active users (users with entries in last 30 days)
  SELECT COUNT(DISTINCT user_id) INTO active_users
  FROM "Journal Entries"
  WHERE created_at > NOW() - INTERVAL '30 days';
  
  health_status := jsonb_build_object(
    'timestamp', NOW(),
    'total_journal_entries', total_entries,
    'total_embeddings', total_embeddings,
    'missing_embeddings', missing_embeddings,
    'active_users_30_days', active_users,
    'embedding_coverage_percent', 
      CASE 
        WHEN total_entries > 0 THEN ROUND((total_embeddings::numeric / total_entries::numeric) * 100, 2)
        ELSE 100
      END,
    'status', 
      CASE 
        WHEN missing_embeddings = 0 THEN 'healthy'
        WHEN missing_embeddings < (total_entries * 0.1) THEN 'good'
        ELSE 'needs_attention'
      END
  );
  
  RETURN health_status;
END;
$function$;

-- Security hardening for session management functions
CREATE OR REPLACE FUNCTION public.enhanced_session_manager(p_user_id uuid, p_action text, p_device_type text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text, p_last_active_page text DEFAULT NULL::text, p_session_fingerprint text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_network_state text DEFAULT NULL::text, p_battery_level integer DEFAULT NULL::integer, p_memory_usage bigint DEFAULT NULL::bigint, p_platform text DEFAULT NULL::text, p_additional_data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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
      
    WHEN 'terminate' THEN
      IF current_session.id IS NOT NULL THEN
        UPDATE user_sessions
        SET 
          is_active = false,
          session_state = 'terminated',
          session_end = NOW(),
          session_duration = NOW() - session_start
        WHERE id = current_session.id;
        
        session_id := current_session.id;
      END IF;
  END CASE;
  
  RETURN session_id;
END;
$function$;