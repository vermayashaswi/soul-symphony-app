-- Enable vector extension and ensure proper schema access
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- Create a wrapper function to fix vector operations
CREATE OR REPLACE FUNCTION public.verify_vector_operations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  test_result jsonb;
  test_embedding extensions.vector;
  embedding_count integer;
  operator_test boolean := false;
BEGIN
  -- Check if vector extension is properly installed
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Vector extension not installed',
      'vector_extension_status', 'missing'
    );
  END IF;
  
  -- Check if we have embeddings in the table
  SELECT COUNT(*) INTO embedding_count FROM journal_embeddings WHERE embedding IS NOT NULL;
  
  -- Test vector operations with actual data if available
  IF embedding_count > 0 THEN
    BEGIN
      -- Try a simple vector operation
      SELECT embedding INTO test_embedding 
      FROM journal_embeddings 
      WHERE embedding IS NOT NULL 
      LIMIT 1;
      
      -- Test the distance operator
      IF test_embedding IS NOT NULL THEN
        SELECT (test_embedding <=> test_embedding) = 0 INTO operator_test;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      operator_test := false;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Vector extension verification completed',
    'vector_extension_status', 'installed',
    'has_embeddings', embedding_count > 0,
    'operator_exists', operator_test,
    'embedding_count', embedding_count
  );
END;
$$;

-- Fix the match_journal_entries function to use proper schema
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
SET search_path TO 'public', 'extensions'
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
    AND je.embedding IS NOT NULL
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fix the match_journal_entries_with_date function
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
SET search_path TO 'public', 'extensions'
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