-- Fix time variable replacement in execute_dynamic_query function
DROP FUNCTION IF EXISTS public.execute_dynamic_query(text, text);

CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, user_timezone text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  processed_query text;
  user_tz text;
  current_time timestamp with time zone := NOW();
  current_date_only date := CURRENT_DATE;
  results jsonb := '[]'::jsonb;
  row_data jsonb;
  total_rows integer := 0;
  execution_start_time timestamp with time zone := clock_timestamp();
  current_time_in_tz timestamp with time zone;
  week_start timestamp with time zone;
  week_end timestamp with time zone;
  last_week_start timestamp with time zone;
  last_week_end timestamp with time zone;
  month_start timestamp with time zone;
  month_end timestamp with time zone;
  last_month_start timestamp with time zone;
  last_month_end timestamp with time zone;
BEGIN
  -- Validate and normalize user timezone
  user_tz := COALESCE(user_timezone, 'UTC');
  
  -- Convert current time to user timezone for all calculations
  current_time_in_tz := current_time AT TIME ZONE user_tz;
  
  -- Calculate all time ranges in user timezone, then convert back to UTC for storage compatibility
  week_start := date_trunc('week', current_time_in_tz) AT TIME ZONE user_tz;
  week_end := (date_trunc('week', current_time_in_tz) + INTERVAL '6 days 23:59:59') AT TIME ZONE user_tz;
  last_week_start := (date_trunc('week', current_time_in_tz) - INTERVAL '7 days') AT TIME ZONE user_tz;
  last_week_end := (date_trunc('week', current_time_in_tz) - INTERVAL '1 second') AT TIME ZONE user_tz;
  month_start := date_trunc('month', current_time_in_tz) AT TIME ZONE user_tz;
  month_end := (date_trunc('month', current_time_in_tz) + INTERVAL '1 month - 1 second') AT TIME ZONE user_tz;
  last_month_start := (date_trunc('month', current_time_in_tz) - INTERVAL '1 month') AT TIME ZONE user_tz;
  last_month_end := (date_trunc('month', current_time_in_tz) - INTERVAL '1 second') AT TIME ZONE user_tz;
  
  -- Log timezone information for debugging
  RAISE NOTICE 'execute_dynamic_query: Using user timezone: %, Current server time: %', user_tz, current_time;
  RAISE NOTICE 'Time calculations: last_week_start=%, last_week_end=%', last_week_start, last_week_end;
  
  -- Process time variables in the query with user timezone awareness
  processed_query := query_text;
  
  -- Replace time variables with properly calculated timezone-aware timestamps
  processed_query := REPLACE(processed_query, '__NOW__', '''' || current_time::text || '''');
  processed_query := REPLACE(processed_query, '__TODAY__', '''' || date_trunc('day', current_time_in_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__YESTERDAY__', '''' || (date_trunc('day', current_time_in_tz) - INTERVAL '1 day')::text || '''');
  
  -- Week calculations (properly converted)
  processed_query := REPLACE(processed_query, '__CURRENT_WEEK_START__', '''' || week_start::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_WEEK_END__', '''' || week_end::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_WEEK_START__', '''' || last_week_start::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_WEEK_END__', '''' || last_week_end::text || '''');
  
  -- Month calculations (properly converted)
  processed_query := REPLACE(processed_query, '__CURRENT_MONTH_START__', '''' || month_start::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_MONTH_END__', '''' || month_end::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_MONTH_START__', '''' || last_month_start::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_MONTH_END__', '''' || last_month_end::text || '''');
  
  -- Relative time calculations
  processed_query := REPLACE(processed_query, '__30_DAYS_AGO__', '''' || (current_time - INTERVAL '30 days')::text || '''');
  processed_query := REPLACE(processed_query, '__7_DAYS_AGO__', '''' || (current_time - INTERVAL '7 days')::text || '''');
  
  -- Log the processed query for debugging (first 500 chars)
  RAISE NOTICE 'Timezone-aware processed query (first 500 chars): %', left(processed_query, 500);
  
  -- Execute the query and build results efficiently
  FOR row_data IN 
    EXECUTE 'SELECT to_jsonb(t) FROM (' || processed_query || ') t'
  LOOP
    results := results || jsonb_build_array(row_data);
    total_rows := total_rows + 1;
  END LOOP;
  
  -- Return success result with timezone metadata
  result := jsonb_build_object(
    'success', true,
    'data', results,
    'query', processed_query,
    'row_count', total_rows,
    'execution_time', extract(epoch from clock_timestamp() - execution_start_time),
    'timezone_info', jsonb_build_object(
      'user_timezone', user_tz,
      'server_time', current_time,
      'user_local_time', current_time_in_tz::text,
      'last_week_start', last_week_start::text,
      'last_week_end', last_week_end::text
    )
  );
  
  RETURN result;
  
EXCEPTION 
  WHEN syntax_error THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'SQL Syntax Error: ' || SQLERRM,
      'error_code', 'SYNTAX_ERROR',
      'query', processed_query,
      'timezone_info', jsonb_build_object('user_timezone', user_tz),
      'suggestion', 'Check SQL syntax and table/column names'
    );
    RETURN result;
    
  WHEN undefined_table THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Table Not Found: ' || SQLERRM,
      'error_code', 'UNDEFINED_TABLE',
      'query', processed_query,
      'timezone_info', jsonb_build_object('user_timezone', user_tz),
      'suggestion', 'Verify table names - use "Journal Entries" for journal entries table'
    );
    RETURN result;
    
  WHEN undefined_column THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Column Not Found: ' || SQLERRM,
      'error_code', 'UNDEFINED_COLUMN',
      'query', processed_query,
      'timezone_info', jsonb_build_object('user_timezone', user_tz),
      'suggestion', 'Check column names - common columns: "refined text", "transcription text", emotions, themes, master_themes'
    );
    RETURN result;
    
  WHEN others THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'query', processed_query,
      'timezone_info', jsonb_build_object('user_timezone', user_tz),
      'suggestion', 'Check query logic and data types'
    );
    RETURN result;
END;
$function$;

-- Add unique constraint on chat_messages for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_dedup 
ON public.chat_messages(thread_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Function to create message with deduplication
CREATE OR REPLACE FUNCTION public.create_chat_message_with_dedup(
  p_thread_id uuid,
  p_content text,
  p_sender text,
  p_role text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  -- Check for existing message with same idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_id 
    FROM chat_messages 
    WHERE thread_id = p_thread_id 
    AND idempotency_key = p_idempotency_key;
    
    IF existing_id IS NOT NULL THEN
      RAISE NOTICE 'Duplicate message prevented for idempotency_key: %', p_idempotency_key;
      RETURN existing_id;
    END IF;
  END IF;
  
  -- Create new message
  INSERT INTO chat_messages (thread_id, content, sender, role, idempotency_key)
  VALUES (p_thread_id, p_content, p_sender, p_role, p_idempotency_key)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$function$;