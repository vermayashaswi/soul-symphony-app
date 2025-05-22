
-- Function to match journal entries by vector similarity with improved date range filtering
CREATE OR REPLACE FUNCTION match_journal_entries_with_date(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_filter uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  created_at timestamp with time zone,
  similarity float,
  themes text[],
  emotions jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log date parameters for debugging
  RAISE NOTICE 'Date filter parameters - Start: %, End: %', start_date, end_date;
  
  -- First check if date parameters are valid
  IF start_date IS NOT NULL AND end_date IS NOT NULL AND start_date > end_date THEN
    RAISE NOTICE 'Invalid date range: start_date (%) is after end_date (%)', start_date, end_date;
    -- Return empty set for invalid date range
    RETURN;
  END IF;

  -- Apply date filtering first, then vector similarity
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
$$;
