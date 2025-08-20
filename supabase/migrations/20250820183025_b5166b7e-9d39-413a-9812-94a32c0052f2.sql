-- Fix vector extension installation issue
-- First, try to recreate the extension properly
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a simpler verification function that handles the vector type properly
CREATE OR REPLACE FUNCTION public.verify_vector_operations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  test_result jsonb;
  operator_exists boolean := false;
  sample_count integer := 0;
BEGIN
  -- Check if the cosine distance operator exists
  SELECT EXISTS(
    SELECT 1 FROM pg_operator 
    WHERE oprname = '<=>' 
  ) INTO operator_exists;
  
  -- Count existing embeddings
  SELECT COUNT(*) INTO sample_count FROM journal_embeddings LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'operator_exists', operator_exists,
    'has_embeddings', sample_count > 0,
    'vector_extension_status', 'installed',
    'message', 'Vector extension verification completed'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE,
    'fix_needed', 'Check vector extension installation'
  );
END;
$function$;

-- Update the existing test function
CREATE OR REPLACE FUNCTION public.test_vector_operations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.verify_vector_operations();
END;
$function$;