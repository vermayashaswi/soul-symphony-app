-- Performance Optimization: Add database maintenance functions and additional security hardening

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

-- Security hardening for more critical functions
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion(emotion_name text, user_id_filter uuid, min_score double precision DEFAULT 0.3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, emotion_score double precision, embedding extensions.vector)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme(theme_query text, user_id_filter uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, themes text[], similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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

-- Add comprehensive maintenance function
CREATE OR REPLACE FUNCTION public.perform_database_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  expired_trials integer;
  expired_sessions integer;
  maintenance_result jsonb;
BEGIN
  -- Clean up expired trials
  SELECT updated_count INTO expired_trials
  FROM jsonb_populate_record(null::record, public.cleanup_expired_trials()) AS (updated_count integer);
  
  -- Clean up expired sessions
  SELECT public.cleanup_expired_sessions() INTO expired_sessions;
  
  -- Build result
  maintenance_result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'expired_trials_cleaned', expired_trials,
    'expired_sessions_cleaned', expired_sessions,
    'message', 'Database maintenance completed successfully'
  );
  
  RETURN maintenance_result;
END;
$function$;

-- Optimize upsert function for journal embeddings
CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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
    content = EXCLUDED.content,
    created_at = NOW();
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
  
  health_status := jsonb_build_object(
    'timestamp', NOW(),
    'total_journal_entries', total_entries,
    'total_embeddings', total_embeddings,
    'missing_embeddings', missing_embeddings,
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