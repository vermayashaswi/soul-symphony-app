-- Create a dedicated RPC function for counting journal entries with date filters
CREATE OR REPLACE FUNCTION public.get_journal_entry_count(
  user_id_filter uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM "Journal Entries" entries
    WHERE 
      entries.user_id = user_id_filter
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  );
END;
$function$;