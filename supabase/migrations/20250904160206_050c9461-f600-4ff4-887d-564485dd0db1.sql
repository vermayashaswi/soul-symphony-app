-- Remove the handle_new_user function and trigger that I added
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Update the auto_start_trial function to set profile_onboarding_completed = true by default
-- since the profile animation is moving to a different place in the user journey
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium';
    NEW.is_premium = true;
    -- Set profile_onboarding_completed = true since animation is moving elsewhere
    NEW.profile_onboarding_completed = COALESCE(NEW.profile_onboarding_completed, true);
    -- Keep regular onboarding as false for new users
    NEW.onboarding_completed = COALESCE(NEW.onboarding_completed, false);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the auto_start_trial trigger is properly attached to profiles table
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON public.profiles;
CREATE TRIGGER auto_start_trial_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_start_trial();

-- Clean up any duplicate profiles that might have been created
-- Keep the most recent profile for each user
DELETE FROM public.profiles p1
WHERE EXISTS (
  SELECT 1 FROM public.profiles p2 
  WHERE p2.id = p1.id 
  AND p2.created_at > p1.created_at
);

-- Update existing profiles to have profile_onboarding_completed = true
-- since the animation is moving to a different place
UPDATE public.profiles 
SET profile_onboarding_completed = true,
    updated_at = NOW()
WHERE profile_onboarding_completed IS NULL OR profile_onboarding_completed = false;