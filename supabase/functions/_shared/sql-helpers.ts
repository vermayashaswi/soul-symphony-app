
export interface JournalEmbeddingResult {
  id: number;
  content: string;
  similarity: number;
}

export interface UserQuery {
  id: string;
  query_text: string;
  created_at: string;
  user_id: string;
  thread_id?: string;
  message_id?: string;
}

export const createJournalEmbeddingsTable = `
CREATE TABLE IF NOT EXISTS public.journal_embeddings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  journal_entry_id BIGINT REFERENCES "Journal Entries"(id) ON DELETE CASCADE NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS journal_embeddings_journal_entry_id_idx ON public.journal_embeddings (journal_entry_id);
`;

// Updated version of the match_journal_entries function with fixed search path
export const matchJournalEntries = `
CREATE OR REPLACE FUNCTION public.match_journal_entries(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  user_id_filter UUID
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_text TEXT;
BEGIN
  -- Convert UUID to text for comparison with user_id in Journal Entries
  user_id_text := user_id_filter::TEXT;
  
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
`;

export const storeUserQuery = `
CREATE OR REPLACE FUNCTION public.store_user_query(
  user_id UUID,
  query_text TEXT,
  query_embedding VECTOR(1536),
  thread_id UUID,
  message_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO user_queries (user_id, query_text, embedding, thread_id, message_id)
  VALUES (user_id, query_text, query_embedding, thread_id, message_id)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;
`;
