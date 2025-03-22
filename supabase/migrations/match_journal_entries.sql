
-- Function to match journal entries by vector similarity
CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
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
  WHERE 1 - (je.embedding <=> query_embedding) > match_threshold
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
