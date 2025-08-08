
-- Remove SET search_path from get_authenticated_user_id
CREATE OR REPLACE FUNCTION public.get_authenticated_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
DECLARE
  user_uuid uuid;
BEGIN
  user_uuid := auth.uid();
  RETURN user_uuid;
END;
$function$;

-- Remove SET search_path from create_profile_safe
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
  authenticated_user_id := auth.uid();
  IF authenticated_user_id IS NULL OR authenticated_user_id != p_user_id THEN
    RETURN false;
  END IF;

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
