-- Fix critical RLS security issues from the migration

-- Add missing session_timeout column if it doesn't exist and set default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_sessions' 
    AND column_name = 'session_timeout'
  ) THEN
    ALTER TABLE public.user_sessions 
    ADD COLUMN session_timeout timestamp with time zone;
  END IF;
END $$;

-- Update session timeout trigger (recreate with proper session timeout handling)
CREATE OR REPLACE FUNCTION public.update_session_timeout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Set session timeout to 24 hours from last activity
  NEW.session_timeout = NEW.last_activity + INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

-- Create trigger for session timeout
DROP TRIGGER IF EXISTS set_session_timeout ON public.user_sessions;
CREATE TRIGGER set_session_timeout
  BEFORE INSERT OR UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_timeout();

-- Enhanced comprehensive cleanup function
CREATE OR REPLACE FUNCTION public.comprehensive_auth_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expired_trials integer := 0;
  expired_sessions integer := 0;
  resolved_errors integer := 0;
  result jsonb;
BEGIN
  -- Clean up expired trials
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    subscription_tier = 'free',
    is_premium = false,
    updated_at = NOW()
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS expired_trials = ROW_COUNT;
  
  -- Clean up expired sessions
  UPDATE public.user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW())
  WHERE 
    is_active = true 
    AND session_timeout IS NOT NULL
    AND session_timeout < NOW();
    
  GET DIAGNOSTICS expired_sessions = ROW_COUNT;
  
  -- Mark old errors as resolved
  UPDATE public.auth_errors
  SET resolved = true, updated_at = NOW()
  WHERE created_at < NOW() - INTERVAL '7 days' AND resolved = false;
  
  GET DIAGNOSTICS resolved_errors = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'expired_trials_cleaned', expired_trials,
    'expired_sessions_cleaned', expired_sessions,
    'resolved_old_errors', resolved_errors,
    'message', 'Comprehensive auth cleanup completed'
  );
  
  RETURN result;
END;
$$;