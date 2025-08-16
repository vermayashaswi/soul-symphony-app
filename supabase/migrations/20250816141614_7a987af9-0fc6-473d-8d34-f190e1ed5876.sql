
-- Fix the vector search operator issue in match_journal_entries_with_date function
CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(
  query_embedding extensions.vector, 
  match_threshold double precision, 
  match_count integer, 
  user_id_filter uuid, 
  start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id bigint, 
  content text, 
  created_at timestamp with time zone, 
  similarity double precision, 
  themes text[], 
  emotions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH date_filtered_entries AS (
    SELECT 
      entries.id,
      entries.created_at,
      je.journal_entry_id,
      je.embedding::extensions.vector as embedding_vector,
      entries.master_themes,
      entries.emotions,
      COALESCE(entries."refined text", entries."transcription text") AS content_text
    FROM
      "Journal Entries" entries
    JOIN
      journal_embeddings je ON je.journal_entry_id = entries.id
    WHERE 
      entries.user_id = user_id_filter
      AND je.embedding IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    dfe.journal_entry_id AS id,
    dfe.content_text AS content,
    dfe.created_at,
    (1 - (dfe.embedding_vector <=> query_embedding::extensions.vector))::double precision AS similarity,
    dfe.master_themes,
    dfe.emotions
  FROM
    date_filtered_entries dfe
  WHERE 
    (1 - (dfe.embedding_vector <=> query_embedding::extensions.vector)) > match_threshold
  ORDER BY
    dfe.embedding_vector <=> query_embedding::extensions.vector
  LIMIT match_count;
END;
$function$
