
-- Phase 1 & 2: Database Infrastructure Repair and Function Cleanup

-- First, ensure pgvector extension is properly configured
CREATE EXTENSION IF NOT EXISTS vector;

-- Fix the match_journal_entries function to use proper vector operations without phantom openai.embedding()
CREATE OR REPLACE FUNCTION public.match_journal_entries(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid)
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
    AND entries.user_id = user_id_filter
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Fix the match_journal_entries_with_date function
CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, similarity double precision, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH date_filtered_entries AS (
    SELECT 
      entries.id,
      entries.created_at,
      je.journal_entry_id,
      je.embedding,
      entries.master_themes,
      entries.emotions,
      COALESCE(entries."refined text", entries."transcription text") AS content_text
    FROM
      "Journal Entries" entries
    JOIN
      journal_embeddings je ON je.journal_entry_id = entries.id
    WHERE 
      entries.user_id = user_id_filter
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    dfe.journal_entry_id AS id,
    dfe.content_text AS content,
    dfe.created_at,
    1 - (dfe.embedding <=> query_embedding) AS similarity,
    dfe.master_themes,
    dfe.emotions
  FROM
    date_filtered_entries dfe
  WHERE 
    1 - (dfe.embedding <=> query_embedding) > match_threshold
  ORDER BY
    dfe.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Fix the match_journal_entries_by_theme function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme(theme_query text, user_id_filter uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, themes text[], similarity double precision)
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Return entries that have master_themes and match the criteria
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.master_themes as themes,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 0.8  -- High similarity for theme matches
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
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    -- Prioritize exact theme matches
    CASE WHEN theme_query = ANY(entries.master_themes) THEN 1 ELSE 0 END DESC,
    -- Then by entry date
    entries.created_at DESC
  LIMIT match_count;
END;
$function$;

-- Fix the match_journal_entries_by_entities function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_entities(entity_queries text[], user_id_filter uuid, match_threshold double precision DEFAULT 0.3, match_count integer DEFAULT 10, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, entities jsonb, similarity double precision, entity_matches jsonb)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.entities,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 0.7  -- Good similarity for entity matches
      ELSE 0.6  -- Default similarity for entity-only matches
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
    -- Prioritize exact entity matches, then by date
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
    entries.created_at DESC
  LIMIT match_count;
END;
$function$;
