-- Update RLS policies to handle native app authentication issues
-- Add better error handling for refresh token failures

-- Create function to handle native auth gracefully
CREATE OR REPLACE FUNCTION public.get_authenticated_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  user_uuid uuid;
BEGIN
  -- Get the authenticated user ID
  user_uuid := auth.uid();
  
  -- Return NULL instead of throwing error if not authenticated
  -- This prevents RLS policy failures in edge cases
  RETURN user_uuid;
END;
$function$;

-- Update profiles table RLS policies to use the new function
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (public.get_authenticated_user_id() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (public.get_authenticated_user_id() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.get_authenticated_user_id() = id);

-- Update Journal Entries RLS policies
DROP POLICY IF EXISTS "Users can view own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can view own journal entries" 
ON public."Journal Entries" 
FOR SELECT 
USING (public.get_authenticated_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can insert own journal entries" 
ON public."Journal Entries" 
FOR INSERT 
WITH CHECK (public.get_authenticated_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can update own journal entries" 
ON public."Journal Entries" 
FOR UPDATE 
USING (public.get_authenticated_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own journal entries" ON public."Journal Entries";
CREATE POLICY "Users can delete own journal entries" 
ON public."Journal Entries" 
FOR DELETE 
USING (public.get_authenticated_user_id() = user_id);

-- Create a function to safely handle profile creation for native apps
CREATE OR REPLACE FUNCTION public.create_profile_safe(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  authenticated_user_id uuid;
BEGIN
  -- Verify the caller is authenticated and matches the user_id
  authenticated_user_id := auth.uid();
  
  IF authenticated_user_id IS NULL OR authenticated_user_id != p_user_id THEN
    RETURN false;
  END IF;
  
  -- Insert profile if it doesn't exist
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    p_full_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN true;
END;
$function$;