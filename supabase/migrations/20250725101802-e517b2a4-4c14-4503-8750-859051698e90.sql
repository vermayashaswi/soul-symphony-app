-- Cleanup migration: Remove test/duplicate users and profiles
-- Keep only the two legitimate users: 1e7caad7-180d-439c-abd4-2f0d45256f68 and 816cd85c-a03b-44b8-a8ed-5b3b03a196bd

-- Step 1: Delete unwanted profiles (keep only the two legitimate users)
DELETE FROM public.profiles 
WHERE id NOT IN (
  '1e7caad7-180d-439c-abd4-2f0d45256f68',
  '816cd85c-a03b-44b8-a8ed-5b3b03a196bd'
);

-- Step 2: Delete unwanted journal entries for removed users (to maintain data integrity)
DELETE FROM "Journal Entries" 
WHERE user_id NOT IN (
  '1e7caad7-180d-439c-abd4-2f0d45256f68',
  '816cd85c-a03b-44b8-a8ed-5b3b03a196bd'
);

-- Step 3: Delete unwanted journal embeddings for removed entries
DELETE FROM journal_embeddings 
WHERE journal_entry_id NOT IN (
  SELECT id FROM "Journal Entries"
);

-- Step 4: Delete unwanted user sessions for removed users
DELETE FROM user_sessions 
WHERE user_id NOT IN (
  '1e7caad7-180d-439c-abd4-2f0d45256f68',
  '816cd85c-a03b-44b8-a8ed-5b3b03a196bd'
);

-- Step 5: Delete unwanted chat threads for removed users
DELETE FROM chat_threads 
WHERE user_id NOT IN (
  '1e7caad7-180d-439c-abd4-2f0d45256f68',
  '816cd85c-a03b-44b8-a8ed-5b3b03a196bd'
);

-- Step 6: Delete unwanted auth.users entries (keep only the two legitimate users)
-- This will cascade and clean up any remaining auth-related data
DELETE FROM auth.users 
WHERE id NOT IN (
  '1e7caad7-180d-439c-abd4-2f0d45256f68',
  '816cd85c-a03b-44b8-a8ed-5b3b03a196bd'
);

-- Step 7: Add safeguard function to prevent unauthorized profile creation
CREATE OR REPLACE FUNCTION public.validate_profile_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow profile creation for users that exist in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot create profile for non-existent user';
  END IF;
  
  -- Prevent duplicate profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Profile already exists for user';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 8: Add validation trigger to profiles table
DROP TRIGGER IF EXISTS validate_profile_creation_trigger ON public.profiles;
CREATE TRIGGER validate_profile_creation_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_creation();

-- Step 9: Update handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if profile already exists to prevent duplicates
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Only create profiles for confirmed users with valid email
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name,
      display_name,
      avatar_url,
      timezone,
      trial_ends_at,
      subscription_status,
      subscription_tier,
      is_premium
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'name'),
      NEW.raw_user_meta_data ->> 'avatar_url',
      COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC'),
      NOW() + INTERVAL '14 days',
      'trial',
      'premium',
      true
    );
  END IF;
  
  RETURN NEW;
END;
$function$;