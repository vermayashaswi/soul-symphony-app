
-- Function to match journal entries by vector similarity with date range filter
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
  embedding vector(1536)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.journal_entry_id AS id,
    je.content,
    entries.created_at,
    1 - (je.embedding <=> query_embedding) AS similarity,
    je.embedding
  FROM
    journal_embeddings je
  JOIN
    "Journal Entries" entries ON je.journal_entry_id = entries.id
  WHERE 
    1 - (je.embedding <=> query_embedding) > match_threshold
    AND entries.user_id = user_id_filter::text  -- Cast UUID to text to match column type
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
