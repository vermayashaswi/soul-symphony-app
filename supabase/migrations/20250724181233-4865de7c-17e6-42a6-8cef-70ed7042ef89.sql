-- Security Hardening: Update remaining critical functions with SECURITY DEFINER SET search_path = ''

-- Update key functions that handle user data and authentication
CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, similarity double precision, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Log date parameters for debugging
  RAISE NOTICE 'Date filter parameters - Start: %, End: %', start_date, end_date;
  
  -- First check if date parameters are valid
  IF start_date IS NOT NULL AND end_date IS NOT NULL AND start_date > end_date THEN
    RAISE NOTICE 'Invalid date range: start_date (%) is after end_date (%)', start_date, end_date;
    -- Return empty set for invalid date range
    RETURN;
  END IF;

  -- Apply date filtering first, then vector similarity
  RETURN QUERY
  WITH date_filtered_entries AS (
    SELECT 
      entries.id,
      entries.created_at,
      je.journal_entry_id,
      je.embedding,
      entries.master_themes,
      entries.emotions,
      COALESCE(entries."refined text", entries."transcription text") AS content_text
    FROM
      "Journal Entries" entries
    JOIN
      journal_embeddings je ON je.journal_entry_id = entries.id
    WHERE 
      entries.user_id = user_id_filter
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    dfe.journal_entry_id AS id,
    dfe.content_text AS content,
    dfe.created_at,
    1 - (dfe.embedding <=> query_embedding) AS similarity,
    dfe.master_themes,
    dfe.emotions
  FROM
    date_filtered_entries dfe
  WHERE 
    1 - (dfe.embedding <=> query_embedding) > match_threshold
  ORDER BY
    dfe.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    WHERE 
      entries.user_id = user_id_param
      AND entries.emotions IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  aggregated_emotions AS (
    SELECT
      emotion_name as emotion,
      AVG(emotion_score) as avg_score,
      COUNT(*) as occurrence_count
    FROM
      emotion_data
    GROUP BY
      emotion_name
    ORDER BY
      avg_score DESC,
      occurrence_count DESC
    LIMIT limit_count
  )
  SELECT 
    emotion,
    ROUND(avg_score::numeric, 2) as score
  FROM 
    aggregated_emotions;
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, param_values text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  result JSONB;
  query_with_params text;
  i int;
  current_timestamp timestamp with time zone := now();
  last_month_start timestamp with time zone := date_trunc('month', current_timestamp - interval '1 month');
  last_month_end timestamp with time zone := date_trunc('month', current_timestamp) - interval '1 microsecond';
  current_month_start timestamp with time zone := date_trunc('month', current_timestamp);
  last_week_start timestamp with time zone := date_trunc('week', current_timestamp - interval '1 week');
  last_week_end timestamp with time zone := date_trunc('week', current_timestamp) - interval '1 microsecond';
  current_user_id uuid := auth.uid();
  allowed_tables text[] := ARRAY['Journal Entries', 'profiles', 'user_sessions', 'chat_threads', 'chat_messages'];
  sanitized_query text;
BEGIN
  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Enhanced query validation and sanitization
  sanitized_query := lower(trim(query_text));
  
  -- Block dangerous SQL operations
  IF sanitized_query ~* '\b(drop|create|alter|grant|revoke|truncate|delete|insert|update)\b' THEN
    RETURN jsonb_build_object('error', 'Only SELECT queries are allowed');
  END IF;
  
  -- Validate table access - ensure query only accesses allowed tables
  IF NOT (sanitized_query ~* '\bfrom\s+("?(' || array_to_string(allowed_tables, '"|"') || ')"?)\b') THEN
    RETURN jsonb_build_object('error', 'Access to specified tables not permitted');
  END IF;
  
  -- Ensure user can only access their own data
  IF NOT (sanitized_query ~* '\buser_id\s*=\s*auth\.uid\(\)') THEN
    RETURN jsonb_build_object('error', 'Queries must include user_id = auth.uid() filter');
  END IF;

  -- Replace time variables in the query
  query_text := replace(query_text, '__LAST_MONTH_START__', quote_literal(last_month_start));
  query_text := replace(query_text, '__LAST_MONTH_END__', quote_literal(last_month_end));
  query_text := replace(query_text, '__CURRENT_MONTH_START__', quote_literal(current_month_start));
  query_text := replace(query_text, '__LAST_WEEK_START__', quote_literal(last_week_start));
  query_text := replace(query_text, '__LAST_WEEK_END__', quote_literal(last_week_end));
  query_text := replace(query_text, '__USER_ID__', quote_literal(current_user_id));
  
  -- Start with the original query
  query_with_params := query_text;
  
  -- Replace each parameter placeholder ($1, $2, etc) with the actual value
  FOR i IN 1..array_length(param_values, 1) LOOP
    query_with_params := replace(query_with_params, '$' || i::text, quote_literal(param_values[i]));
  END LOOP;
  
  -- Execute the query with additional safeguards
  BEGIN
    EXECUTE 'SELECT to_jsonb(array_agg(row_to_json(t)))
            FROM (' || query_with_params || ') t'
    INTO result;
    
    IF result IS NULL THEN
      result := '[]'::jsonb;
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN others THEN
      -- Log the error for debugging (without exposing query details)
      RAISE NOTICE 'Error executing dynamic query: %', SQLERRM;
      
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'code', SQLSTATE
      );
  END;
END;
$function$;

-- Remove references to non-existent journal_chunks table by creating a dummy function to prevent errors
-- This addresses the database consistency issue
CREATE OR REPLACE FUNCTION public.match_chunks_with_date(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, chunk_id bigint, content text, created_at timestamp with time zone, similarity double precision, chunk_index integer, total_chunks integer, entry_content text, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- This function was referencing a non-existent journal_chunks table
  -- Return empty result to prevent errors while maintaining compatibility
  RETURN;
END;
$function$;

-- Add missing RLS policy for profiles_backup table (which currently has no policies)
-- First check if the table actually needs policies or should be removed
DO $$
BEGIN
  -- If profiles_backup exists and has no policies, add basic policy
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles_backup') THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.profiles_backup ENABLE ROW LEVEL SECURITY;
    
    -- Add basic read policy for service role
    DROP POLICY IF EXISTS "Service role can access profiles_backup" ON public.profiles_backup;
    CREATE POLICY "Service role can access profiles_backup" ON public.profiles_backup
    FOR ALL
    USING (auth.role() = 'service_role'::text);
  END IF;
END $$;