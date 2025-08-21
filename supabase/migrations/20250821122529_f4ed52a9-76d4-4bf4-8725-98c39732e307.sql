-- Comprehensive timezone fix for execute_dynamic_query function
CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, user_timezone text DEFAULT 'UTC')
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
BEGIN
  -- Validate and normalize user timezone
  user_tz := COALESCE(user_timezone, 'UTC');
  
  -- Log timezone information for debugging
  RAISE NOTICE 'execute_dynamic_query: Using user timezone: %, Current server time: %', user_tz, current_time;
  
  -- Process time variables in the query with user timezone awareness
  processed_query := query_text;
  
  -- Replace time variables with timezone-aware calculations
  -- All calculations are done in the user's timezone, then converted to timestamp with timezone for storage
  processed_query := REPLACE(processed_query, '__NOW__', '''' || (current_time AT TIME ZONE user_tz)::timestamp with time zone::text || '''');
  processed_query := REPLACE(processed_query, '__TODAY__', '''' || (date_trunc('day', current_time AT TIME ZONE user_tz) AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__YESTERDAY__', '''' || (date_trunc('day', current_time AT TIME ZONE user_tz) - INTERVAL '1 day' AT TIME ZONE user_tz)::text || '''');
  
  -- Week calculations (user timezone aware)
  processed_query := REPLACE(processed_query, '__CURRENT_WEEK_START__', '''' || (date_trunc('week', current_time AT TIME ZONE user_tz) AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_WEEK_END__', '''' || (date_trunc('week', current_time AT TIME ZONE user_tz) + INTERVAL '6 days 23:59:59' AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_WEEK_START__', '''' || (date_trunc('week', current_time AT TIME ZONE user_tz) - INTERVAL '7 days' AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_WEEK_END__', '''' || (date_trunc('week', current_time AT TIME ZONE user_tz) - INTERVAL '1 second' AT TIME ZONE user_tz)::text || '''');
  
  -- Month calculations (user timezone aware)
  processed_query := REPLACE(processed_query, '__CURRENT_MONTH_START__', '''' || (date_trunc('month', current_time AT TIME ZONE user_tz) AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_MONTH_END__', '''' || (date_trunc('month', current_time AT TIME ZONE user_tz) + INTERVAL '1 month - 1 second' AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_MONTH_START__', '''' || (date_trunc('month', current_time AT TIME ZONE user_tz) - INTERVAL '1 month' AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_MONTH_END__', '''' || (date_trunc('month', current_time AT TIME ZONE user_tz) - INTERVAL '1 second' AT TIME ZONE user_tz)::text || '''');
  
  -- Relative time calculations (user timezone aware)
  processed_query := REPLACE(processed_query, '__30_DAYS_AGO__', '''' || ((current_time AT TIME ZONE user_tz) - INTERVAL '30 days' AT TIME ZONE user_tz)::text || '''');
  processed_query := REPLACE(processed_query, '__7_DAYS_AGO__', '''' || ((current_time AT TIME ZONE user_tz) - INTERVAL '7 days' AT TIME ZONE user_tz)::text || '''');
  
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
      'user_local_time', (current_time AT TIME ZONE user_tz)::text
    )
  );
  
  RETURN result;
  
EXCEPTION 
  WHEN syntax_error THEN
    -- Handle SQL syntax errors
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
    -- Handle table not found errors
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
    -- Handle column not found errors
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
    -- Handle all other errors
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