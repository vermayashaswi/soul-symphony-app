
-- Step 1: Fix the OpenAI Embedding Function
CREATE OR REPLACE FUNCTION openai.embedding(input text)
RETURNS extensions.vector(1536)
LANGUAGE plpgsql
AS $$
BEGIN
  -- This is a placeholder function that returns NULL for now
  -- In production, this would call the actual OpenAI embedding API
  RETURN NULL::extensions.vector(1536);
END;
$$;

-- Step 2: Fix match_journal_entries_with_date function with proper vector operations
CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(
  query_embedding extensions.vector(1536), 
  match_threshold double precision, 
  match_count integer, 
  user_id_filter uuid, 
  start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id bigint, 
  content text, 
  created_at timestamp with time zone, 
  similarity double precision, 
  themes text[], 
  emotions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    (1 - (je.embedding <=> query_embedding))::double precision AS similarity,
    entries.master_themes,
    entries.emotions
  FROM
    "Journal Entries" entries
  JOIN
    journal_embeddings je ON je.journal_entry_id = entries.id
  WHERE 
    entries.user_id = user_id_filter
    AND je.embedding IS NOT NULL
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
    AND (1 - (je.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Step 3: Fix match_journal_entries function
CREATE OR REPLACE FUNCTION public.match_journal_entries(
  query_embedding extensions.vector(1536), 
  match_threshold double precision, 
  match_count integer, 
  user_id_filter uuid
)
RETURNS TABLE(
  id bigint, 
  content text, 
  similarity double precision, 
  embedding extensions.vector, 
  created_at timestamp with time zone, 
  themes text[], 
  emotions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    je.journal_entry_id AS id,
    je.content,
    (1 - (je.embedding <=> query_embedding))::double precision AS similarity,
    je.embedding,
    entries.created_at,
    entries.master_themes,
    entries.emotions
  FROM
    journal_embeddings je
  JOIN
    "Journal Entries" entries ON je.journal_entry_id = entries.id
  WHERE 
    (1 - (je.embedding <=> query_embedding)) > match_threshold
    AND entries.user_id = user_id_filter
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Step 4: Fix match_journal_entries_by_emotion function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion(
  emotion_name text, 
  user_id_filter uuid, 
  min_score double precision DEFAULT 0.3, 
  start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  limit_count integer DEFAULT 5
)
RETURNS TABLE(
  id bigint, 
  content text, 
  created_at timestamp with time zone, 
  emotion_score double precision, 
  embedding extensions.vector
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
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

-- Step 5: Fix match_journal_entries_by_theme_array function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme_array(
  theme_queries text[], 
  user_id_filter uuid, 
  match_threshold double precision DEFAULT 0.3, 
  match_count integer DEFAULT 15, 
  start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id bigint, 
  content text, 
  created_at timestamp with time zone, 
  themes text[], 
  emotions jsonb, 
  similarity double precision, 
  theme_matches jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.master_themes,
    entries.emotions,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 0.8 
      ELSE 0.6 
    END AS similarity,
    (
      SELECT jsonb_agg(DISTINCT theme_match)
      FROM unnest(entries.master_themes) as theme_item,
           unnest(theme_queries) as query_theme
      WHERE theme_item ILIKE '%' || query_theme || '%' OR query_theme ILIKE '%' || theme_item || '%'
    ) as theme_matches
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.master_themes IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM unnest(entries.master_themes) as theme_item,
           unnest(theme_queries) as query_theme
      WHERE theme_item ILIKE '%' || query_theme || '%' OR query_theme ILIKE '%' || theme_item || '%'
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$function$;

-- Step 6: Fix match_journal_entries_by_entities function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_entities(
  entity_queries text[], 
  user_id_filter uuid, 
  match_threshold double precision DEFAULT 0.3, 
  match_count integer DEFAULT 15, 
  start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id bigint, 
  content text, 
  created_at timestamp with time zone, 
  entities jsonb, 
  emotions jsonb, 
  similarity double precision, 
  entity_matches jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.entities,
    entries.emotions,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 0.8 
      ELSE 0.6 
    END AS similarity,
    (
      SELECT jsonb_agg(DISTINCT entity_match)
      FROM jsonb_each(entries.entities) as ent(ent_key, ent_value),
           jsonb_array_elements_text(ent_value) as entity_item,
           unnest(entity_queries) as query_entity
      WHERE entity_item ILIKE '%' || query_entity || '%' OR query_entity ILIKE '%' || entity_item || '%'
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
           jsonb_array_elements_text(ent_value) as entity_item,
           unnest(entity_queries) as query_entity
      WHERE entity_item ILIKE '%' || query_entity || '%' OR query_entity ILIKE '%' || entity_item || '%'
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$function$;

-- Step 7: Add upsert_journal_embedding function if it doesn't exist
CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(
  entry_id bigint,
  embedding_vector extensions.vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $function$
BEGIN
  INSERT INTO journal_embeddings (journal_entry_id, embedding, content)
  SELECT 
    entry_id,
    embedding_vector,
    COALESCE(je."refined text", je."transcription text")
  FROM "Journal Entries" je
  WHERE je.id = entry_id
  ON CONFLICT (journal_entry_id) 
  DO UPDATE SET
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content;
END;
$function$;
