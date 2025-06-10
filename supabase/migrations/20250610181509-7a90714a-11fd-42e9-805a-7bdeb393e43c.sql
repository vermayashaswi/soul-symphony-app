
-- 1. Add the missing 'themes' column to Journal Entries table
ALTER TABLE "Journal Entries" 
ADD COLUMN IF NOT EXISTS themes text[];

-- 2. Add unique constraint to journal_embeddings table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'journal_embeddings_journal_entry_id_unique'
    ) THEN
        ALTER TABLE journal_embeddings 
        ADD CONSTRAINT journal_embeddings_journal_entry_id_unique 
        UNIQUE (journal_entry_id);
    END IF;
END $$;

-- 3. Update the upsert_journal_embedding function to handle the constraint properly
CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO journal_embeddings (journal_entry_id, content, embedding)
  SELECT 
    entry_id,
    COALESCE(je."refined text", je."transcription text", '') as content,
    embedding_vector
  FROM "Journal Entries" je
  WHERE je.id = entry_id
  ON CONFLICT (journal_entry_id) 
  DO UPDATE SET 
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content;
END;
$function$;

-- 4. Create a function to regenerate missing data for entries that need them
CREATE OR REPLACE FUNCTION public.regenerate_missing_data_for_entry(target_entry_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  entry_record RECORD;
  result jsonb := '{}';
BEGIN
  -- Get the entry details
  SELECT id, "refined text", "transcription text", user_id, sentiment, themes, master_themes, entities, emotions
  INTO entry_record
  FROM "Journal Entries"
  WHERE id = target_entry_id;
  
  IF entry_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Entry not found');
  END IF;
  
  -- Clear existing data that needs to be regenerated
  UPDATE "Journal Entries"
  SET 
    themes = NULL,
    master_themes = NULL,
    themeemotion = NULL,
    entities = NULL,
    emotions = NULL,
    sentiment = '0'
  WHERE id = target_entry_id;
  
  -- Delete existing embedding to force regeneration
  DELETE FROM journal_embeddings WHERE journal_entry_id = target_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', target_entry_id,
    'message', 'Entry data cleared for regeneration'
  );
END;
$function$;
