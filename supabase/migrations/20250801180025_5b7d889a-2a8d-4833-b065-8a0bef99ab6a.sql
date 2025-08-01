-- First, drop the existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON public.profiles;

-- Update the auto_start_trial function to handle profile creation properly
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
    -- Ensure tutorial setup for new users
    NEW.tutorial_completed = 'NO';
    NEW.tutorial_step = 0;
    NEW.onboarding_completed = false;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the proper trigger on profiles table
CREATE TRIGGER auto_start_trial_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_start_trial();