-- Step 1: Create the handle_new_user function to automatically create profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert a new profile for the user
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
    NOW() + INTERVAL '14 days', -- Start with 14-day trial
    'trial',
    'premium',
    true
  );
  
  RETURN NEW;
END;
$function$;

-- Step 2: Create the trigger on auth.users to automatically create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Fix existing users without profiles
INSERT INTO public.profiles (
  id, 
  email, 
  trial_ends_at,
  subscription_status,
  subscription_tier,
  is_premium
)
SELECT 
  au.id,
  au.email,
  NOW() + INTERVAL '14 days',
  'trial',
  'premium',
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Step 4: Update the auto_start_trial function to use proper search_path
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now (updated from 7 days)
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium'; -- Fixed: Set to premium during trial
    NEW.is_premium = true; -- Grant premium access during trial
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 5: Ensure the auto_start_trial trigger exists on profiles table
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON public.profiles;
CREATE TRIGGER auto_start_trial_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_start_trial();

-- Step 6: Fix search_path security issues in other functions
CREATE OR REPLACE FUNCTION public.get_user_profile_with_trial(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_data RECORD;
  is_trial_active BOOLEAN := false;
  result JSONB;
BEGIN
  -- Verify user can access this profile
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Get profile with subscription info
  SELECT * INTO profile_data
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF profile_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Check trial status
  IF profile_data.trial_ends_at IS NOT NULL THEN
    is_trial_active := profile_data.trial_ends_at > NOW();
  END IF;
  
  -- Build comprehensive result
  result := jsonb_build_object(
    'id', profile_data.id,
    'email', profile_data.email,
    'full_name', profile_data.full_name,
    'display_name', profile_data.display_name,
    'avatar_url', profile_data.avatar_url,
    'subscription_status', COALESCE(profile_data.subscription_status, 'free'),
    'subscription_tier', COALESCE(profile_data.subscription_tier, 'free'),
    'is_premium', COALESCE(profile_data.is_premium, false),
    'trial_ends_at', profile_data.trial_ends_at,
    'is_trial_active', is_trial_active,
    'onboarding_completed', COALESCE(profile_data.onboarding_completed, false),
    'phone_verified', COALESCE(profile_data.phone_verified, false),
    'created_at', profile_data.created_at,
    'updated_at', profile_data.updated_at
  );
  
  RETURN result;
END;
$function$;