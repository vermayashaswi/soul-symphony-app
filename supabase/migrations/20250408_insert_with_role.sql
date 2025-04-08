
-- Create a function to execute inserts with service role
CREATE OR REPLACE FUNCTION public.execute_insert_with_role(
  query_text text,
  param_values text[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE query_text 
  USING param_values[1], param_values[2], param_values[3], param_values[4], param_values[5]
  INTO result;
  
  RETURN result;
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;
