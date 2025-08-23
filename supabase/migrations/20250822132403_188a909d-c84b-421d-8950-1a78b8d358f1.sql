-- Simplify execute_dynamic_query by removing complex time variable replacement logic
-- Keep only the core query execution functionality

CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, user_timezone text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  results jsonb := '[]'::jsonb;
  row_data jsonb;
  total_rows integer := 0;
  execution_start_time timestamp with time zone := clock_timestamp();
BEGIN
  -- Validate and normalize user timezone
  user_timezone := COALESCE(user_timezone, 'UTC');
  
  -- Log timezone information for debugging
  RAISE NOTICE 'execute_dynamic_query: Using user timezone: %, Query: %', user_timezone, left(query_text, 200);
  
  -- Execute the query and build results efficiently
  FOR row_data IN 
    EXECUTE 'SELECT to_jsonb(t) FROM (' || query_text || ') t'
  LOOP
    results := results || jsonb_build_array(row_data);
    total_rows := total_rows + 1;
  END LOOP;
  
  -- Return success result with timezone metadata
  result := jsonb_build_object(
    'success', true,
    'data', results,
    'query', query_text,
    'row_count', total_rows,
    'execution_time', extract(epoch from clock_timestamp() - execution_start_time),
    'timezone_info', jsonb_build_object(
      'user_timezone', user_timezone
    )
  );
  
  RETURN result;
  
EXCEPTION 
  WHEN syntax_error THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'SQL Syntax Error: ' || SQLERRM,
      'error_code', 'SYNTAX_ERROR',
      'query', query_text,
      'timezone_info', jsonb_build_object('user_timezone', user_timezone),
      'suggestion', 'Check SQL syntax and table/column names'
    );
    RETURN result;
    
  WHEN undefined_table THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Table Not Found: ' || SQLERRM,
      'error_code', 'UNDEFINED_TABLE',
      'query', query_text,
      'timezone_info', jsonb_build_object('user_timezone', user_timezone),
      'suggestion', 'Verify table names - use "Journal Entries" for journal entries table'
    );
    RETURN result;
    
  WHEN undefined_column THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Column Not Found: ' || SQLERRM,
      'error_code', 'UNDEFINED_COLUMN',
      'query', query_text,
      'timezone_info', jsonb_build_object('user_timezone', user_timezone),
      'suggestion', 'Check column names - common columns: "refined text", emotions, themes, master_themes'
    );
    RETURN result;
    
  WHEN others THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'query', query_text,
      'timezone_info', jsonb_build_object('user_timezone', user_timezone),
      'suggestion', 'Check query logic and data types'
    );
    RETURN result;
END;
$function$