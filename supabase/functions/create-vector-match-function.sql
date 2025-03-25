
CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector,
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
DECLARE
  user_id_text text;
BEGIN
  -- Convert UUID to text for comparison with user_id in Journal Entries
  user_id_text := user_id_filter::text;
  
  -- For debugging
  RAISE NOTICE 'Searching for entries with user_id: %', user_id_text;
  
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
    AND entries.user_id = user_id_text
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
