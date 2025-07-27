-- Complete Phase 1 Security Fixes: Fix remaining database function search paths (Part 2)
-- Skip vector-dependent functions for now and focus on the rest

CREATE OR REPLACE FUNCTION public.check_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE plpgsql
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_entries_by_emotion_term(emotion_term text, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at
  FROM
    "Journal Entries" entries
  WHERE 
    entries.user_id = user_id_filter::text
    AND (
      (entries.emotions IS NOT NULL AND 
       EXISTS (
         SELECT 1 FROM jsonb_object_keys(entries.emotions) AS emotion_key 
         WHERE emotion_key ILIKE '%' || emotion_term || '%'
       ))
      OR 
      (entries."refined text" IS NOT NULL AND entries."refined text" ILIKE '%' || emotion_term || '%')
      OR
      (entries."transcription text" IS NOT NULL AND entries."transcription text" ILIKE '%' || emotion_term || '%')
      OR
      (entries.master_themes IS NOT NULL AND 
       EXISTS (
         SELECT 1 FROM unnest(entries.master_themes) AS theme 
         WHERE theme ILIKE '%' || emotion_term || '%'
       ))
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    entries.created_at DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_missing_data_for_entry(target_entry_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.set_default_translation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.translation_status = 'completed';
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_all_user_journal_entries(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector)
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion_strength(emotion_name text, user_id_filter uuid, match_count integer DEFAULT 3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter::text
    AND entries.emotions IS NOT NULL 
    AND entries.emotions ? emotion_name
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    CAST(entries.emotions->>emotion_name AS float) DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions_with_entries(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric, sample_entries jsonb)
LANGUAGE plpgsql
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.table_exists(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  );
END;
$function$;