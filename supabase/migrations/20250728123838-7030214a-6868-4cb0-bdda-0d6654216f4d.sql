-- Phase 1: Database Cleanup - Remove all custom session tracking

-- Drop functions related to user sessions
DROP FUNCTION IF EXISTS public.simple_session_manager(uuid, text, text);
DROP FUNCTION IF EXISTS public.close_user_session(uuid, uuid);
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
DROP FUNCTION IF EXISTS public.update_user_sessions_updated_at();

-- Drop triggers on user_sessions table
DROP TRIGGER IF EXISTS update_user_sessions_updated_at_trigger ON public.user_sessions;

-- Drop RLS policies on user_sessions table
DROP POLICY IF EXISTS "System can manage sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;

-- Drop the user_sessions table entirely
DROP TABLE IF EXISTS public.user_sessions CASCADE;