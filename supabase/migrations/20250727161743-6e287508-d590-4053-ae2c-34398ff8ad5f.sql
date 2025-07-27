-- Complete Phase 1 Security Fixes: Fix remaining database function search paths (Part 3)

CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  -- Update expired trials to free status
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
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', format('Updated %s expired trials to free status', updated_count)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_chunks_with_date(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, chunk_id bigint, content text, created_at timestamp with time zone, similarity double precision, chunk_index integer, total_chunks integer, entry_content text, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- This function was referencing a non-existent journal_chunks table
  -- Return empty result to prevent errors while maintaining compatibility
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.perform_database_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.check_database_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_top_emotions(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    WHERE 
      entries.user_id = user_id_param
      AND entries.emotions IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
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
    emotion,
    ROUND(avg_score::numeric, 2) as score
  FROM 
    aggregated_emotions;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions_by_chunks(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric, sample_chunks jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score,
      entries.id,
      chunks.content as chunk_content,
      chunks.id as chunk_id,
      chunks.chunk_index,
      entries.created_at
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    JOIN
      journal_chunks chunks ON entries.id = chunks.journal_entry_id
    WHERE 
      entries.user_id = user_id_param::text  -- Fixed: Cast the parameter to text instead of the column
      AND entries.emotions IS NOT NULL
      AND entries.is_chunked = true
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  top_chunks_per_emotion AS (
    SELECT
      emotion_name,
      id as entry_id,
      chunk_id,
      chunk_content,
      created_at,
      emotion_score,
      chunk_index,
      ROW_NUMBER() OVER (PARTITION BY emotion_name ORDER BY emotion_score DESC, created_at DESC) as rank
    FROM
      emotion_data
  ),
  sample_chunks AS (
    SELECT
      emotion_name,
      jsonb_agg(
        jsonb_build_object(
          'entry_id', entry_id,
          'chunk_id', chunk_id,
          'content', chunk_content,
          'created_at', created_at,
          'score', emotion_score,
          'chunk_index', chunk_index
        )
      ) as chunks_json
    FROM
      top_chunks_per_emotion
    WHERE
      rank <= 3
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
    COALESCE(sc.chunks_json, '[]'::jsonb) as sample_chunks
  FROM 
    aggregated_emotions ae
  LEFT JOIN
    sample_chunks sc ON ae.emotion = sc.emotion_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme_array(theme_queries text[], user_id_filter uuid, match_threshold double precision DEFAULT 0.3, match_count integer DEFAULT 10, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, themes text[], similarity double precision, theme_matches text[])
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.master_themes as themes,
    GREATEST(
      CASE WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> openai.embedding(array_to_string(theme_queries, ' ')))
      ELSE 0.5 END
    ) AS similarity,
    ARRAY(
      SELECT unnest(theme_queries) 
      WHERE unnest(theme_queries) = ANY(entries.master_themes)
    ) as theme_matches
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.master_themes IS NOT NULL
    AND entries.master_themes && theme_queries  -- PostgreSQL array overlap operator
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    -- Prioritize exact theme matches, then similarity
    array_length(ARRAY(
      SELECT unnest(theme_queries) 
      WHERE unnest(theme_queries) = ANY(entries.master_themes)
    ), 1) DESC NULLS LAST,
    similarity DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_theme_statistics(user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 20)
RETURNS TABLE(theme text, entry_count bigint, avg_sentiment_score numeric, first_occurrence timestamp with time zone, last_occurrence timestamp with time zone)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH theme_stats AS (
    SELECT
      unnest(entries.master_themes) as theme_name,
      entries.id,
      entries.created_at,
      CASE 
        WHEN entries.sentiment = 'positive' THEN 1
        WHEN entries.sentiment = 'neutral' THEN 0
        WHEN entries.sentiment = 'negative' THEN -1
        ELSE 0
      END as sentiment_numeric
    FROM
      "Journal Entries" entries
    WHERE 
      entries.user_id = user_id_filter
      AND entries.master_themes IS NOT NULL
      AND array_length(entries.master_themes, 1) > 0
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    ts.theme_name as theme,
    COUNT(*)::bigint as entry_count,
    ROUND(AVG(ts.sentiment_numeric)::numeric, 2) as avg_sentiment_score,
    MIN(ts.created_at) as first_occurrence,
    MAX(ts.created_at) as last_occurrence
  FROM
    theme_stats ts
  GROUP BY
    ts.theme_name
  ORDER BY
    entry_count DESC,
    last_occurrence DESC
  LIMIT limit_count;
END;
$function$;