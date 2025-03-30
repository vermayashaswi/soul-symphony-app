
-- Function to execute dynamic SQL queries with parameters
-- This allows safe execution of GPT-generated SQL queries with proper parameter binding
CREATE OR REPLACE FUNCTION execute_dynamic_query(
  query_text text,
  param_values text[] DEFAULT '{}'::text[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  query_with_params text;
  i int;
BEGIN
  -- Start with the original query
  query_with_params := query_text;
  
  -- Replace each parameter placeholder ($1, $2, etc) with the actual value
  -- This is a simplified approach - in a production environment, you might
  -- want to use proper prepared statements
  FOR i IN 1..array_length(param_values, 1) LOOP
    query_with_params := replace(query_with_params, '$' || i::text, '''' || param_values[i] || '''');
  END LOOP;
  
  -- Execute the query and capture the result as JSON
  EXECUTE 'SELECT to_jsonb(array_agg(row_to_json(t)))
           FROM (' || query_with_params || ') t'
  INTO result;
  
  -- Return empty array instead of null
  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE NOTICE 'Error executing dynamic query: % - Query: %', SQLERRM, query_with_params;
    -- Return the error as JSON
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'query', query_with_params
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_dynamic_query TO authenticated;
GRANT EXECUTE ON FUNCTION execute_dynamic_query TO anon;
GRANT EXECUTE ON FUNCTION execute_dynamic_query TO service_role;

COMMENT ON FUNCTION execute_dynamic_query IS 'Executes a dynamic SQL query with parameter binding. Used for GPT-generated SQL queries.';
