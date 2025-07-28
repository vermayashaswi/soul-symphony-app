-- Revert SQL changes that are causing Android app loader issues

-- 1. Disable Row Level Security on storage.objects table
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 2. Drop the safe_session_manager function
DROP FUNCTION IF EXISTS public.safe_session_manager(uuid, text, text);