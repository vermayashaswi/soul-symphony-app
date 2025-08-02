-- Phase 1: Database Session Management Improvements

-- Add session resumption function
CREATE OR REPLACE FUNCTION public.resume_or_create_session(
  p_user_id uuid, 
  p_device_type text DEFAULT NULL,
  p_entry_page text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_session_id uuid;
  new_session_id uuid;
  idle_timeout_minutes integer := 30; -- 30 minute idle timeout
BEGIN
  -- Look for an existing active session that hasn't exceeded idle timeout
  SELECT id INTO existing_session_id
  FROM user_sessions
  WHERE 
    user_id = p_user_id 
    AND is_active = true
    AND last_activity > NOW() - (idle_timeout_minutes || ' minutes')::INTERVAL
  ORDER BY last_activity DESC
  LIMIT 1;
  
  -- If we found a resumable session, update it and return
  IF existing_session_id IS NOT NULL THEN
    UPDATE user_sessions
    SET 
      last_activity = NOW(),
      session_timeout = NOW() + '24:00:00'::interval,
      updated_at = NOW()
    WHERE id = existing_session_id;
    
    RETURN existing_session_id;
  END IF;
  
  -- Close any existing sessions for this user (cleanup duplicates)
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = NOW(),
    session_duration = NOW() - session_start
  WHERE 
    user_id = p_user_id 
    AND is_active = true;
  
  -- Create new session
  INSERT INTO user_sessions (
    user_id,
    device_type,
    start_page,
    last_activity
  ) VALUES (
    p_user_id,
    p_device_type,
    p_entry_page,
    NOW()
  ) RETURNING id INTO new_session_id;
  
  RETURN new_session_id;
END;
$function$;

-- Add function to gracefully close expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_idle_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  closed_count integer;
  idle_timeout_minutes integer := 30;
BEGIN
  -- Close sessions that have been idle for more than 30 minutes
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW()),
    session_duration = COALESCE(session_duration, NOW() - session_start)
  WHERE 
    is_active = true 
    AND last_activity < NOW() - (idle_timeout_minutes || ' minutes')::INTERVAL;
    
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  
  RETURN closed_count;
END;
$function$;

-- Add function to extend session activity
CREATE OR REPLACE FUNCTION public.extend_session_activity(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE user_sessions
  SET 
    last_activity = NOW(),
    session_timeout = NOW() + '24:00:00'::interval,
    updated_at = NOW()
  WHERE 
    id = p_session_id 
    AND user_id = p_user_id 
    AND is_active = true;
    
  RETURN FOUND;
END;
$function$;