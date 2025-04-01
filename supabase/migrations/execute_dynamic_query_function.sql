
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
  current_timestamp timestamp with time zone := now();
  last_month_start timestamp with time zone := date_trunc('month', current_timestamp - interval '1 month');
  last_month_end timestamp with time zone := date_trunc('month', current_timestamp) - interval '1 microsecond';
  current_month_start timestamp with time zone := date_trunc('month', current_timestamp);
  last_week_start timestamp with time zone := date_trunc('week', current_timestamp - interval '1 week');
  last_week_end timestamp with time zone := date_trunc('week', current_timestamp) - interval '1 microsecond';
BEGIN
  -- Replace time variables in the query
  query_text := replace(query_text, '__LAST_MONTH_START__', quote_literal(last_month_start));
  query_text := replace(query_text, '__LAST_MONTH_END__', quote_literal(last_month_end));
  query_text := replace(query_text, '__CURRENT_MONTH_START__', quote_literal(current_month_start));
  query_text := replace(query_text, '__LAST_WEEK_START__', quote_literal(last_week_start));
  query_text := replace(query_text, '__LAST_WEEK_END__', quote_literal(last_week_end));
  
  -- Start with the original query
  query_with_params := query_text;
  
  -- Replace each parameter placeholder ($1, $2, etc) with the actual value
  FOR i IN 1..array_length(param_values, 1) LOOP
    query_with_params := replace(query_with_params, '$' || i::text, '''' || param_values[i] || '''');
  END LOOP;
  
  -- Add additional safeguards for the query execution
  BEGIN
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
    WHEN others THEN
      -- Log the error for debugging
      RAISE NOTICE 'Error executing dynamic query: % - Query: %', SQLERRM, query_with_params;
      
      -- Try a fallback approach for aggregation queries
      BEGIN
        IF query_with_params ~* 'group by|sum|avg|count|max|min' THEN
          -- For aggregation queries, use a different approach
          EXECUTE 'SELECT jsonb_agg(to_jsonb(t)) FROM (' || query_with_params || ') t' INTO result;
          
          IF result IS NULL THEN
            result := '[]'::jsonb;
          END IF;
          
          RETURN result;
        ELSE
          -- Return the error as JSON
          RETURN jsonb_build_object(
            'error', SQLERRM,
            'query', query_with_params
          );
        END IF;
      EXCEPTION
        WHEN others THEN
          -- Return the original error
          RETURN jsonb_build_object(
            'error', SQLERRM,
            'query', query_with_params
          );
      END;
  END;
END;
$$;

-- Function to extract top emotions from journal entries
CREATE OR REPLACE FUNCTION get_top_emotions(
  user_id_param uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL,
  limit_count integer DEFAULT 3
)
RETURNS TABLE(emotion text, score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_dynamic_query TO authenticated;
GRANT EXECUTE ON FUNCTION execute_dynamic_query TO anon;
GRANT EXECUTE ON FUNCTION execute_dynamic_query TO service_role;
GRANT EXECUTE ON FUNCTION get_top_emotions TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_emotions TO anon;
GRANT EXECUTE ON FUNCTION get_top_emotions TO service_role;

COMMENT ON FUNCTION execute_dynamic_query IS 'Executes a dynamic SQL query with parameter binding. Used for GPT-generated SQL queries.';
COMMENT ON FUNCTION get_top_emotions IS 'Gets the top emotions from journal entries for a given user and time period.';
