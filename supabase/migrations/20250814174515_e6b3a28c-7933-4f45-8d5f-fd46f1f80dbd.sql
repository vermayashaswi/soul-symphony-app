-- Revert security hardening: Remove SET search_path TO 'public' from database functions

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_journal_entry_count(user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM "Journal Entries" entries
    WHERE 
      entries.user_id = user_id_filter
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resume_or_create_session(p_user_id uuid, p_device_type text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  existing_session_id uuid;
  new_session_id uuid;
  idle_timeout_minutes integer := 30; -- 30 minute idle timeout
BEGIN
  -- Look for an existing active session that hasn't exceeded idle timeout
  SELECT id INTO existing_session_id
  FROM user_sessions
  WHERE 
    user_id = p_user_id 
    AND is_active = true
    AND last_activity > NOW() - (idle_timeout_minutes || ' minutes')::INTERVAL
  ORDER BY last_activity DESC
  LIMIT 1;
  
  -- If we found a resumable session, update it and return
  IF existing_session_id IS NOT NULL THEN
    UPDATE user_sessions
    SET 
      last_activity = NOW(),
      session_timeout = NOW() + '24:00:00'::interval,
      updated_at = NOW()
    WHERE id = existing_session_id;
    
    RETURN existing_session_id;
  END IF;
  
  -- Close any existing sessions for this user (cleanup duplicates)
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = NOW(),
    session_duration = NOW() - session_start
  WHERE 
    user_id = p_user_id 
    AND is_active = true;
  
  -- Create new session
  INSERT INTO user_sessions (
    user_id,
    device_type,
    start_page,
    last_activity
  ) VALUES (
    p_user_id,
    p_device_type,
    p_entry_page,
    NOW()
  ) RETURNING id INTO new_session_id;
  
  RETURN new_session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_idle_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  closed_count integer;
  idle_timeout_minutes integer := 30;
BEGIN
  -- Close sessions that have been idle for more than 30 minutes
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW()),
    session_duration = COALESCE(session_duration, NOW() - session_start)
  WHERE 
    is_active = true 
    AND last_activity < NOW() - (idle_timeout_minutes || ' minutes')::INTERVAL;
    
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  
  RETURN closed_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extend_session_activity(p_session_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE user_sessions
  SET 
    last_activity = NOW(),
    session_timeout = NOW() + '24:00:00'::interval,
    updated_at = NOW()
  WHERE 
    id = p_session_id 
    AND user_id = p_user_id 
    AND is_active = true;
    
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_session_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_time_of_day_distribution(start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, user_timezone text DEFAULT 'UTC'::text)
 RETURNS TABLE(bucket text, entry_count bigint, percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  total_count bigint;
BEGIN
  -- Total entries in range for current authenticated user
  SELECT COUNT(*) INTO total_count
  FROM "Journal Entries" entries
  WHERE entries.user_id = auth.uid()
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date);

  RETURN QUERY
  WITH bucketed AS (
    SELECT
      CASE 
        WHEN EXTRACT(HOUR FROM (entries.created_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) BETWEEN 0 AND 5 THEN 'night'
        WHEN EXTRACT(HOUR FROM (entries.created_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) BETWEEN 6 AND 11 THEN 'morning'
        WHEN EXTRACT(HOUR FROM (entries.created_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) BETWEEN 12 AND 17 THEN 'afternoon'
        ELSE 'evening'
      END AS bucket
    FROM "Journal Entries" entries
    WHERE entries.user_id = auth.uid()
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  counts AS (
    SELECT bucket, COUNT(*)::bigint AS entry_count
    FROM bucketed
    GROUP BY bucket
  )
  SELECT 
    c.bucket,
    c.entry_count,
    CASE 
      WHEN total_count > 0 THEN ROUND((c.entry_count::numeric / total_count::numeric) * 100.0, 2)
      ELSE 0
    END AS percentage
  FROM counts c
  ORDER BY array_position(ARRAY['night','morning','afternoon','evening'], c.bucket);

END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_themes()
 RETURNS TABLE(id integer, name text, description text, display_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.display_order
  FROM public.themes t
  WHERE t.is_active = true
  ORDER BY t.display_order ASC, t.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries(query_embedding extensions.vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id bigint, content text, similarity double precision, embedding extensions.vector, created_at timestamp with time zone, themes text[], emotions jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    je.journal_entry_id AS id,
    je.content,
    1 - (je.embedding <=> query_embedding) AS similarity,
    je.embedding,
    entries.created_at,
    entries.master_themes,
    entries.emotions
  FROM
    journal_embeddings je
  JOIN
    "Journal Entries" entries ON je.journal_entry_id = entries.id
  WHERE 
    1 - (je.embedding <=> query_embedding) > match_threshold
    AND entries.user_id = auth.uid()
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;