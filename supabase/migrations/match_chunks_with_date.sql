
-- Function to match journal chunks by vector similarity with date range filter
CREATE OR REPLACE FUNCTION match_chunks_with_date(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_filter uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id bigint,                   -- Journal entry ID
  chunk_id bigint,             -- Chunk ID
  content text,                -- Chunk content
  created_at timestamp with time zone,
  similarity float,
  chunk_index int,             -- Position of chunk in original entry
  total_chunks int,            -- Total chunks in the entry
  entry_content text,          -- Full entry content
  themes text[],               -- Themes from parent entry
  emotions jsonb               -- Emotions from parent entry
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    chunks.id as chunk_id,
    chunks.content,
    entries.created_at,
    1 - (chunks.embedding <=> query_embedding) AS similarity,
    chunks.chunk_index,
    chunks.total_chunks,
    COALESCE(entries."refined text", entries."transcription text") as entry_content,
    entries.master_themes,
    entries.emotions
  FROM
    journal_chunks chunks
  JOIN
    "Journal Entries" entries ON chunks.journal_entry_id = entries.id
  WHERE 
    1 - (chunks.embedding <=> query_embedding) > match_threshold
    AND entries.user_id = user_id_filter::text  -- Cast UUID to text to match column type
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
