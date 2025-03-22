
-- Function to match journal entries by vector similarity
CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_filter uuid
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.journal_entry_id AS id,
    je.content,
    1 - (je.embedding <=> query_embedding) AS similarity
  FROM
    journal_embeddings je
  JOIN
    "Journal Entries" entries ON je.journal_entry_id = entries.id
  WHERE 
    1 - (je.embedding <=> query_embedding) > match_threshold
    AND (user_id_filter IS NULL OR entries.user_id = user_id_filter::text)
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
