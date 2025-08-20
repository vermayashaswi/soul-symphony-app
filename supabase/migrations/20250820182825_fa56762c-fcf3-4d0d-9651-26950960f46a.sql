-- Fix vector extension and operators
-- Ensure vector extension is properly loaded with all operators
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector CASCADE;

-- Verify vector operators are available and create a test function
CREATE OR REPLACE FUNCTION public.verify_vector_operations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  test_result jsonb;
  sample_embedding extensions.vector;
  similarity_result double precision;
  operator_exists boolean := false;
BEGIN
  -- Check if the cosine distance operator exists
  SELECT EXISTS(
    SELECT 1 FROM pg_operator 
    WHERE oprname = '<=>' 
    AND oprleft = 'vector'::regtype 
    AND oprright = 'vector'::regtype
  ) INTO operator_exists;
  
  IF NOT operator_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vector cosine distance operator <=> not found',
      'fix_needed', 'Run CREATE EXTENSION vector CASCADE;'
    );
  END IF;
  
  -- Get a sample embedding from the database
  SELECT embedding INTO sample_embedding
  FROM journal_embeddings
  LIMIT 1;
  
  IF sample_embedding IS NULL THEN
    -- Create a test vector if no embeddings exist
    sample_embedding := array_fill(0.1, ARRAY[1536])::extensions.vector;
  END IF;
  
  -- Test the cosine distance operator
  SELECT (1 - (sample_embedding <=> sample_embedding))::double precision INTO similarity_result;
  
  RETURN jsonb_build_object(
    'success', true,
    'operator_exists', operator_exists,
    'self_similarity', similarity_result,
    'embedding_dimensions', array_length(sample_embedding::real[], 1),
    'message', 'Vector operations working correctly'
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

-- Update the existing test function to use the new verification
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