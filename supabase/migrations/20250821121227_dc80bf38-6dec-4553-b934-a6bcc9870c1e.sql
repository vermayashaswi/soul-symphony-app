-- Fix the execute_dynamic_query function time variable replacement
CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  processed_query text;
  current_time timestamp with time zone := NOW();
  current_date_only date := CURRENT_DATE;
  results jsonb := '[]'::jsonb;
  row_data jsonb;
  total_rows integer := 0;
BEGIN
  -- Process time variables in the query
  processed_query := query_text;
  
  -- Replace time variables with actual timestamps (fixed timezone casting)
  processed_query := REPLACE(processed_query, '__NOW__', '''' || current_time::text || '''');
  processed_query := REPLACE(processed_query, '__TODAY__', '''' || current_date_only::text || '''');
  processed_query := REPLACE(processed_query, '__YESTERDAY__', '''' || (current_date_only - INTERVAL '1 day')::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_WEEK_START__', '''' || (date_trunc('week', current_time::timestamp))::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_WEEK_END__', '''' || (date_trunc('week', current_time::timestamp) + INTERVAL '6 days 23:59:59')::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_WEEK_START__', '''' || (date_trunc('week', current_time::timestamp) - INTERVAL '7 days')::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_WEEK_END__', '''' || (date_trunc('week', current_time::timestamp) - INTERVAL '1 second')::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_MONTH_START__', '''' || (date_trunc('month', current_time::timestamp))::text || '''');
  processed_query := REPLACE(processed_query, '__CURRENT_MONTH_END__', '''' || (date_trunc('month', current_time::timestamp) + INTERVAL '1 month - 1 second')::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_MONTH_START__', '''' || (date_trunc('month', current_time::timestamp) - INTERVAL '1 month')::text || '''');
  processed_query := REPLACE(processed_query, '__LAST_MONTH_END__', '''' || (date_trunc('month', current_time::timestamp) - INTERVAL '1 second')::text || '''');
  processed_query := REPLACE(processed_query, '__30_DAYS_AGO__', '''' || (current_time - INTERVAL '30 days')::text || '''');
  processed_query := REPLACE(processed_query, '__7_DAYS_AGO__', '''' || (current_time - INTERVAL '7 days')::text || '''');
  
  -- Log the processed query for debugging
  RAISE NOTICE 'Executing processed query: %', left(processed_query, 500);
  
  -- Execute the query and build results efficiently
  FOR row_data IN 
    EXECUTE 'SELECT to_jsonb(t) FROM (' || processed_query || ') t'
  LOOP
    results := results || jsonb_build_array(row_data);
    total_rows := total_rows + 1;
  END LOOP;
  
  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'data', results,
    'query', processed_query,
    'row_count', total_rows,
    'execution_time', extract(epoch from clock_timestamp() - current_time)
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
      'suggestion', 'Check query logic and data types'
    );
    RETURN result;
END;
$function$;