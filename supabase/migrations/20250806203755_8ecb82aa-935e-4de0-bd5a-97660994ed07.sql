-- Restore the original working auto_start_trial function from database-fixes.sql
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Ensure the trigger is properly set up on profiles table
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON public.profiles;
CREATE TRIGGER auto_start_trial_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_start_trial();

-- Update any existing trial users that might have incorrect tier
UPDATE public.profiles 
SET 
  subscription_tier = 'premium',
  updated_at = NOW()
WHERE 
  subscription_status = 'trial' 
  AND is_premium = true 
  AND subscription_tier = 'free';