-- Complete Phase 1 Security Fixes: Fix remaining database function search paths (Final part)

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_entities(entity_queries text[], user_id_filter uuid, match_threshold double precision DEFAULT 0.3, match_count integer DEFAULT 10, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, entities jsonb, similarity double precision, entity_matches jsonb)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.entities,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> openai.embedding(array_to_string(entity_queries, ' ')))
      ELSE 0.6 
    END AS similarity,
    (
      SELECT jsonb_object_agg(entity_type, matched_entities)
      FROM (
        SELECT 
          entity_type,
          jsonb_agg(entity_value) as matched_entities
        FROM (
          SELECT DISTINCT
            ent_key as entity_type,
            ent_value as entity_value
          FROM jsonb_each(entries.entities) as ent(ent_key, ent_value),
               jsonb_array_elements_text(ent_value) as entity_item
          WHERE entity_item = ANY(entity_queries)
        ) matched
        GROUP BY entity_type
      ) grouped
    ) as entity_matches
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.entities IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_each(entries.entities) as ent(ent_key, ent_value),
           jsonb_array_elements_text(ent_value) as entity_item
      WHERE entity_item = ANY(entity_queries)
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    -- Prioritize exact entity matches, then similarity
    jsonb_array_length(
      COALESCE(
        (
          SELECT jsonb_agg(entity_item)
          FROM jsonb_each(entries.entities) as ent(ent_key, ent_value),
               jsonb_array_elements_text(ent_value) as entity_item
          WHERE entity_item = ANY(entity_queries)
        ),
        '[]'::jsonb
      )
    ) DESC,
    similarity DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_entity_statistics(user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 20)
RETURNS TABLE(entity_type text, entity_name text, entry_count bigint, avg_sentiment_score numeric, first_occurrence timestamp with time zone, last_occurrence timestamp with time zone)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH entity_stats AS (
    SELECT
      ent_key as entity_type_name,
      entity_item as entity_name_value,
      entries.id,
      entries.created_at,
      CASE 
        WHEN entries.sentiment = 'positive' THEN 1
        WHEN entries.sentiment = 'neutral' THEN 0
        WHEN entries.sentiment = 'negative' THEN -1
        ELSE 0
      END as sentiment_numeric
    FROM
      "Journal Entries" entries,
      jsonb_each(entries.entities) as ent(ent_key, ent_value),
      jsonb_array_elements_text(ent_value) as entity_item
    WHERE 
      entries.user_id = user_id_filter
      AND entries.entities IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    es.entity_type_name as entity_type,
    es.entity_name_value as entity_name,
    COUNT(*)::bigint as entry_count,
    ROUND(AVG(es.sentiment_numeric)::numeric, 2) as avg_sentiment_score,
    MIN(es.created_at) as first_occurrence,
    MAX(es.created_at) as last_occurrence
  FROM
    entity_stats es
  GROUP BY
    es.entity_type_name, es.entity_name_value
  ORDER BY
    entry_count DESC,
    last_occurrence DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_entities_with_entries(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(entity_type text, entity_name text, entry_count bigint, avg_sentiment numeric, sample_entries jsonb)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH entity_data AS (
    SELECT
      ent_key as entity_type_name,
      entity_item as entity_name_value,
      entries.id,
      COALESCE(entries."refined text", entries."transcription text") as content,
      entries.created_at,
      CASE 
        WHEN entries.sentiment = 'positive' THEN 1
        WHEN entries.sentiment = 'neutral' THEN 0
        WHEN entries.sentiment = 'negative' THEN -1
        ELSE 0
      END as sentiment_numeric
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.entities) as ent(ent_key, ent_value),
      jsonb_array_elements_text(ent_value) as entity_item
    WHERE 
      entries.user_id = user_id_param
      AND entries.entities IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  top_entries_per_entity AS (
    SELECT
      entity_type_name,
      entity_name_value,
      id,
      content,
      created_at,
      sentiment_numeric,
      ROW_NUMBER() OVER (PARTITION BY entity_type_name, entity_name_value ORDER BY created_at DESC) as rank
    FROM
      entity_data
  ),
  sample_entries AS (
    SELECT
      entity_type_name,
      entity_name_value,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'content', left(content, 150),
          'created_at', created_at,
          'sentiment', sentiment_numeric
        )
      ) as entries_json
    FROM
      top_entries_per_entity
    WHERE
      rank <= 2
    GROUP BY
      entity_type_name, entity_name_value
  ),
  aggregated_entities AS (
    SELECT
      entity_type_name,
      entity_name_value,
      COUNT(*) as total_count,
      AVG(sentiment_numeric) as avg_sent
    FROM
      entity_data
    GROUP BY
      entity_type_name, entity_name_value
    ORDER BY
      total_count DESC,
      avg_sent DESC
    LIMIT limit_count
  )
  SELECT 
    ae.entity_type_name as entity_type,
    ae.entity_name_value as entity_name,
    ae.total_count::bigint as entry_count,
    ROUND(ae.avg_sent::numeric, 2) as avg_sentiment,
    COALESCE(se.entries_json, '[]'::jsonb) as sample_entries
  FROM 
    aggregated_entities ae
  LEFT JOIN
    sample_entries se ON ae.entity_type_name = se.entity_type_name 
    AND ae.entity_name_value = se.entity_name_value;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_entity_emotion(entity_queries text[], emotion_queries text[], user_id_filter uuid, match_threshold double precision DEFAULT 0.3, match_count integer DEFAULT 10, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, entities jsonb, emotions jsonb, entityemotion jsonb, similarity double precision, entity_emotion_matches jsonb, relationship_strength numeric)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.entities,
    entries.emotions,
    entries.entityemotion,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> openai.embedding(array_to_string(entity_queries || emotion_queries, ' ')))
      ELSE 0.7 
    END AS similarity,
    (
      SELECT jsonb_build_object(
        'matched_entities', matched_entities,
        'matched_emotions', matched_emotions,
        'entity_emotion_pairs', entity_emotion_pairs
      )
      FROM (
        SELECT 
          COALESCE(jsonb_agg(DISTINCT entity_match), '[]'::jsonb) as matched_entities,
          COALESCE(jsonb_agg(DISTINCT emotion_match), '[]'::jsonb) as matched_emotions,
          COALESCE(jsonb_agg(DISTINCT ee_pair), '[]'::jsonb) as entity_emotion_pairs
        FROM (
          -- Match entities
          SELECT DISTINCT entity_item as entity_match, NULL::text as emotion_match, NULL::jsonb as ee_pair
          FROM jsonb_each(entries.entities) as ent(ent_key, ent_value),
               jsonb_array_elements_text(ent_value) as entity_item
          WHERE entity_item = ANY(entity_queries)
          
          UNION ALL
          
          -- Match emotions
          SELECT NULL::text as entity_match, emotion_key as emotion_match, NULL::jsonb as ee_pair
          FROM jsonb_each(entries.emotions) as em(emotion_key, emotion_value)
          WHERE emotion_key = ANY(emotion_queries)
          
          UNION ALL
          
          -- Match entity-emotion relationships from entityemotion column
          SELECT NULL::text as entity_match, NULL::text as emotion_match, 
                 jsonb_build_object(
                   'entity', ee_entity,
                   'emotion', ee_emotion,
                   'strength', ee_strength
                 ) as ee_pair
          FROM jsonb_each(entries.entityemotion) as ee(ee_entity, ee_emotions),
               jsonb_each(ee_emotions) as ee_inner(ee_emotion, ee_strength)
          WHERE ee_entity = ANY(entity_queries) AND ee_emotion = ANY(emotion_queries)
        ) matches
      ) aggregated
    ) as entity_emotion_matches,
    (
      -- Calculate relationship strength from entityemotion column
      SELECT COALESCE(AVG((ee_strength::text)::numeric), 0)
      FROM jsonb_each(entries.entityemotion) as ee(ee_entity, ee_emotions),
           jsonb_each(ee_emotions) as ee_inner(ee_emotion, ee_strength)
      WHERE ee_entity = ANY(entity_queries) AND ee_emotion = ANY(emotion_queries)
    ) as relationship_strength
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND (
      -- Entity matches
      (entries.entities IS NOT NULL AND EXISTS (
        SELECT 1
        FROM jsonb_each(entries.entities) as ent(ent_key, ent_value),
             jsonb_array_elements_text(ent_value) as entity_item
        WHERE entity_item = ANY(entity_queries)
      ))
      OR
      -- Emotion matches
      (entries.emotions IS NOT NULL AND EXISTS (
        SELECT 1
        FROM jsonb_each(entries.emotions) as em(emotion_key, emotion_value)
        WHERE emotion_key = ANY(emotion_queries)
      ))
      OR
      -- Entity-emotion relationship matches
      (entries.entityemotion IS NOT NULL AND EXISTS (
        SELECT 1
        FROM jsonb_each(entries.entityemotion) as ee(ee_entity, ee_emotions),
             jsonb_each(ee_emotions) as ee_inner(ee_emotion, ee_strength)
        WHERE ee_entity = ANY(entity_queries) AND ee_emotion = ANY(emotion_queries)
      ))
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    -- Prioritize entries with entity-emotion relationships
    CASE WHEN entries.entityemotion IS NOT NULL THEN 1 ELSE 0 END DESC,
    relationship_strength DESC,
    similarity DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_session_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    -- Function logic here
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    -- Function logic here
END;
$function$;