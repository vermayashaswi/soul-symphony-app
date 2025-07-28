-- Enable RLS on tables that have policies but RLS disabled
-- This fixes the critical RLS security issues

-- Find tables with policies but RLS disabled
-- Based on the linter errors, these appear to be storage-related tables

-- Enable RLS on storage.objects (this seems to be the main issue)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Add better error handling for session functions
-- Create a function to safely handle session manager calls with proper error handling
CREATE OR REPLACE FUNCTION public.safe_session_manager(
  p_user_id uuid, 
  p_device_type text DEFAULT NULL, 
  p_entry_page text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_id uuid;
  result jsonb;
BEGIN
  -- Validate input
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User ID is required'
    );
  END IF;

  BEGIN
    -- Try to create session using existing function
    session_id := simple_session_manager(p_user_id, p_device_type, p_entry_page);
    
    result := jsonb_build_object(
      'success', true,
      'session_id', session_id,
      'user_id', p_user_id
    );
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error and return failure response
    INSERT INTO auth_errors (user_id, error_type, error_message, context)
    VALUES (
      p_user_id,
      'session_creation_error',
      SQLERRM,
      'safe_session_manager function'
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session creation failed',
      'details', SQLERRM
    );
  END;
END;
$$;