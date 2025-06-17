
-- Create a function to delete all journal entries for a user
CREATE OR REPLACE FUNCTION public.delete_all_user_journal_entries(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  deleted_count integer;
  embedding_count integer;
BEGIN
  -- Ensure the user is authenticated and can only delete their own entries
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Delete embeddings first (due to foreign key relationships)
  DELETE FROM journal_embeddings 
  WHERE journal_entry_id IN (
    SELECT id FROM "Journal Entries" 
    WHERE user_id = p_user_id
  );
  
  GET DIAGNOSTICS embedding_count = ROW_COUNT;

  -- Delete all journal entries for the user
  DELETE FROM "Journal Entries" 
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_entries', deleted_count,
    'deleted_embeddings', embedding_count
  );
END;
$function$
