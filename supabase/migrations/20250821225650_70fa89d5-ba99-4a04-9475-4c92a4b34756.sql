-- Add PostgreSQL advisory lock functions for request deduplication
-- These functions allow distributed locking across multiple edge function instances

-- Function to try acquiring an advisory lock (non-blocking)
CREATE OR REPLACE FUNCTION public.pg_try_advisory_lock(key bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_lock($1);
$$;

-- Function to release an advisory lock
CREATE OR REPLACE FUNCTION public.pg_advisory_unlock(key bigint)  
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_advisory_unlock($1);
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.pg_try_advisory_lock(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_try_advisory_lock(bigint) TO service_role;

GRANT EXECUTE ON FUNCTION public.pg_advisory_unlock(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_advisory_unlock(bigint) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION public.pg_try_advisory_lock(bigint) IS 'Tries to acquire a session-level advisory lock, returns true if successful';
COMMENT ON FUNCTION public.pg_advisory_unlock(bigint) IS 'Releases a session-level advisory lock, returns true if successful';