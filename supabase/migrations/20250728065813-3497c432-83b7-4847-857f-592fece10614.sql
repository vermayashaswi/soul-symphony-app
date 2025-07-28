-- Fix Authentication Flow - Critical Database Changes

-- 1. Create handle_new_user function to automatically create profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Create profile for new user with trial setup
  INSERT INTO public.profiles (
    id,
    email,
    created_at,
    updated_at,
    trial_ends_at,
    subscription_status,
    subscription_tier,
    is_premium
  ) VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW(),
    NOW() + INTERVAL '14 days',
    'trial',
    'premium',
    true
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- 2. Create trigger on auth.users to call handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Update auto_start_trial trigger to work with new profiles (backup)
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON public.profiles;
CREATE TRIGGER auto_start_trial_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_start_trial();

-- 4. Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- Grant access to sequences (for journal entries)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Create debug function to diagnose auth issues
CREATE OR REPLACE FUNCTION public.debug_user_auth(user_id_param uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  debug_info jsonb := '{}';
  profile_data RECORD;
  entry_count INTEGER;
  current_user_id uuid;
BEGIN
  -- Get current user or use provided parameter
  current_user_id := COALESCE(user_id_param, auth.uid());
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No authenticated user found',
      'auth_uid', auth.uid(),
      'timestamp', NOW()
    );
  END IF;
  
  -- Get profile information
  SELECT * INTO profile_data FROM profiles WHERE id = current_user_id;
  
  -- Count journal entries
  SELECT COUNT(*) INTO entry_count FROM "Journal Entries" WHERE user_id = current_user_id;
  
  -- Build debug response
  debug_info := jsonb_build_object(
    'user_id', current_user_id,
    'profile_exists', (profile_data IS NOT NULL),
    'profile_data', CASE 
      WHEN profile_data IS NOT NULL THEN to_jsonb(profile_data)
      ELSE NULL
    END,
    'journal_entry_count', entry_count,
    'auth_role', auth.role(),
    'timestamp', NOW()
  );
  
  RETURN debug_info;
END;
$function$;

-- 6. Create a simple profile setup fallback function
CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  profile_exists boolean;
  result jsonb;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    -- Create profile with trial
    INSERT INTO profiles (
      id,
      created_at,
      updated_at,
      trial_ends_at,
      subscription_status,
      subscription_tier,
      is_premium
    ) VALUES (
      p_user_id,
      NOW(),
      NOW(),
      NOW() + INTERVAL '14 days',
      'trial',
      'premium',
      true
    );
    
    result := jsonb_build_object(
      'success', true,
      'action', 'profile_created',
      'trial_ends_at', NOW() + INTERVAL '14 days'
    );
  ELSE
    result := jsonb_build_object(
      'success', true,
      'action', 'profile_exists'
    );
  END IF;
  
  RETURN result;
END;
$function$;