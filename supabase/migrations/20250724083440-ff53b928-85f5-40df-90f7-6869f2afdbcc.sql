-- Phase 2: Fix additional function search paths for security hardening

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion(emotion_name text, user_id_filter uuid, min_score double precision DEFAULT 0.3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
 RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, emotion_score double precision, embedding extensions.vector)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    CAST(entries.emotions->>emotion_name AS float) as emotion_score,
    je.embedding
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.emotions IS NOT NULL 
    AND entries.emotions ? emotion_name
    AND CAST(entries.emotions->>emotion_name AS float) >= min_score
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    CAST(entries.emotions->>emotion_name AS float) DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enhanced_check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  user_minute_count INTEGER := 0;
  user_hour_count INTEGER := 0;
  ip_minute_count INTEGER := 0;
  ip_hour_count INTEGER := 0;
  user_minute_limit INTEGER := 10;
  user_hour_limit INTEGER := 100;
  ip_minute_limit INTEGER := 20;
  ip_hour_limit INTEGER := 200;
  result JSONB;
BEGIN
  -- Count user requests in last minute and hour
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO user_minute_count
    FROM api_usage 
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 minute';
      
    SELECT COUNT(*) INTO user_hour_count
    FROM api_usage 
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 hour';
  END IF;

  -- Count IP requests in last minute and hour (stricter limits)
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_minute_count
    FROM api_usage 
    WHERE ip_address = p_ip_address 
      AND created_at > NOW() - INTERVAL '1 minute';
      
    SELECT COUNT(*) INTO ip_hour_count
    FROM api_usage 
    WHERE ip_address = p_ip_address 
      AND created_at > NOW() - INTERVAL '1 hour';
  END IF;

  -- Build result
  result := jsonb_build_object(
    'allowed', true,
    'user_limits', jsonb_build_object(
      'minute', jsonb_build_object('current', user_minute_count, 'limit', user_minute_limit),
      'hour', jsonb_build_object('current', user_hour_count, 'limit', user_hour_limit)
    ),
    'ip_limits', jsonb_build_object(
      'minute', jsonb_build_object('current', ip_minute_count, 'limit', ip_minute_limit),
      'hour', jsonb_build_object('current', ip_hour_count, 'limit', ip_hour_limit)
    )
  );

  -- Check if any limits are exceeded
  IF (p_user_id IS NOT NULL AND (user_minute_count >= user_minute_limit OR user_hour_count >= user_hour_limit)) OR
     (p_ip_address IS NOT NULL AND (ip_minute_count >= ip_minute_limit OR ip_hour_count >= ip_hour_limit)) THEN
    result := jsonb_set(result, '{allowed}', 'false'::jsonb);
    
    -- Determine which limit was hit
    IF user_minute_count >= user_minute_limit THEN
      result := jsonb_set(result, '{limit_type}', '"user_minute"'::jsonb);
    ELSIF user_hour_count >= user_hour_limit THEN
      result := jsonb_set(result, '{limit_type}', '"user_hour"'::jsonb);
    ELSIF ip_minute_count >= ip_minute_limit THEN
      result := jsonb_set(result, '{limit_type}', '"ip_minute"'::jsonb);
    ELSIF ip_hour_count >= ip_hour_limit THEN
      result := jsonb_set(result, '{limit_type}', '"ip_hour"'::jsonb);
    END IF;
  END IF;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme(theme_query text, user_id_filter uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, themes text[], similarity double precision)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- Generate an embedding for the theme query
  SELECT openai.embedding(theme_query) INTO query_embedding;
  
  -- Return entries that have master_themes and match the criteria
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.master_themes as themes,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> query_embedding)
      ELSE 0.3  -- Default similarity for theme-only matches
    END AS similarity
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.master_themes IS NOT NULL
    AND (
      -- Direct theme matching using array operations
      theme_query = ANY(entries.master_themes)
      OR
      -- Partial theme matching (case-insensitive)
      EXISTS (
        SELECT 1 FROM unnest(entries.master_themes) as theme
        WHERE theme ILIKE '%' || theme_query || '%'
      )
      OR
      -- Semantic similarity fallback
      (je.embedding IS NOT NULL AND 1 - (je.embedding <=> query_embedding) > match_threshold)
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    -- Prioritize exact theme matches
    CASE WHEN theme_query = ANY(entries.master_themes) THEN 1 ELSE 0 END DESC,
    -- Then by similarity score
    CASE 
      WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> query_embedding)
      ELSE 0.3
    END DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_phone_verifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  DELETE FROM public.phone_verifications 
  WHERE expires_at < NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_themes()
 RETURNS TABLE(id integer, name text, description text, display_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.display_order
  FROM public.themes t
  WHERE t.is_active = true
  ORDER BY t.display_order ASC, t.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_attribution_analytics(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;