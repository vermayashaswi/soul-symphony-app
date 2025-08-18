
-- Fix the vector search functions to handle proper type casting
-- The issue is with the vector type casting in the distance operator

CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(
  query_embedding extensions.vector,
  match_threshold double precision,
  match_count integer,
  user_id_filter uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
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
SET search_path TO 'public'
AS $$
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
      AND je.embedding IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    dfe.journal_entry_id AS id,
    dfe.content_text AS content,
    dfe.created_at,
    (1 - (dfe.embedding <=> query_embedding))::double precision AS similarity,
    dfe.master_themes,
    dfe.emotions
  FROM
    date_filtered_entries dfe
  WHERE 
    (1 - (dfe.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    dfe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Also fix the main match_journal_entries function
CREATE OR REPLACE FUNCTION public.match_journal_entries(
  query_embedding extensions.vector,
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
AS $$
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
$$;

-- Create a test function to verify vector operations work
CREATE OR REPLACE FUNCTION public.test_vector_operations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  test_result jsonb;
  sample_embedding extensions.vector;
  similarity_result double precision;
BEGIN
  -- Get a sample embedding from the database
  SELECT embedding INTO sample_embedding
  FROM journal_embeddings
  LIMIT 1;
  
  IF sample_embedding IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No embeddings found in database'
    );
  END IF;
  
  -- Test the cosine distance operator
  SELECT (1 - (sample_embedding <=> sample_embedding))::double precision INTO similarity_result;
  
  RETURN jsonb_build_object(
    'success', true,
    'self_similarity', similarity_result,
    'embedding_dimensions', array_length(sample_embedding::real[], 1),
    'message', 'Vector operations working correctly'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;
