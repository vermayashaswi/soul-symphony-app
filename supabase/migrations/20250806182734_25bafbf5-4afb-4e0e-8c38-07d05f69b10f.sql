-- Drop the conflicting function versions to resolve overloading
DROP FUNCTION IF EXISTS public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector);
DROP FUNCTION IF EXISTS public.upsert_journal_embedding(entry_id bigint, embedding_vector text);

-- Create a single, properly typed function for journal embeddings
CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert or update the embedding for the journal entry
  INSERT INTO journal_embeddings (journal_entry_id, embedding, content)
  SELECT 
    entry_id,
    embedding_vector,
    COALESCE(je."refined text", je."transcription text", '')
  FROM "Journal Entries" je
  WHERE je.id = entry_id
  ON CONFLICT (journal_entry_id) 
  DO UPDATE SET
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content;
    
  -- Log successful operation
  RAISE NOTICE 'Successfully upserted embedding for journal entry %', entry_id;
END;
$function$;