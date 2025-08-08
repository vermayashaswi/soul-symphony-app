-- Create function for time-of-day distribution statistics
CREATE OR REPLACE FUNCTION public.get_time_of_day_distribution(
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL,
  user_timezone text DEFAULT 'UTC'
)
RETURNS TABLE(bucket text, entry_count bigint, percentage numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_count bigint;
BEGIN
  -- Total entries in range for current authenticated user
  SELECT COUNT(*) INTO total_count
  FROM "Journal Entries" entries
  WHERE entries.user_id = auth.uid()
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date);

  RETURN QUERY
  WITH bucketed AS (
    SELECT
      CASE 
        WHEN EXTRACT(HOUR FROM (entries.created_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) BETWEEN 0 AND 5 THEN 'night'
        WHEN EXTRACT(HOUR FROM (entries.created_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) BETWEEN 6 AND 11 THEN 'morning'
        WHEN EXTRACT(HOUR FROM (entries.created_at AT TIME ZONE COALESCE(user_timezone, 'UTC'))) BETWEEN 12 AND 17 THEN 'afternoon'
        ELSE 'evening'
      END AS bucket
    FROM "Journal Entries" entries
    WHERE entries.user_id = auth.uid()
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  counts AS (
    SELECT bucket, COUNT(*)::bigint AS entry_count
    FROM bucketed
    GROUP BY bucket
  )
  SELECT 
    c.bucket,
    c.entry_count,
    CASE 
      WHEN total_count > 0 THEN ROUND((c.entry_count::numeric / total_count::numeric) * 100.0, 2)
      ELSE 0
    END AS percentage
  FROM counts c
  ORDER BY array_position(ARRAY['night','morning','afternoon','evening'], c.bucket);

END;
$function$;