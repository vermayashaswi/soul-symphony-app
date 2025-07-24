-- Update the auto_start_trial function to match the latest version
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

-- Create the missing trigger on profiles table
CREATE TRIGGER trigger_auto_start_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_start_trial();

-- Fix any existing users that might have incorrect trial setup
-- This updates users who have trial status but wrong tier
UPDATE public.profiles 
SET 
  subscription_tier = 'premium',
  updated_at = NOW()
WHERE 
  subscription_status = 'trial' 
  AND is_premium = true 
  AND subscription_tier = 'free';

-- Fix users who might be missing trial setup entirely
UPDATE public.profiles 
SET 
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trial',
  subscription_tier = 'premium',
  is_premium = true,
  updated_at = NOW()
WHERE 
  subscription_status IS NULL 
  OR subscription_status = 'free'
  AND trial_ends_at IS NULL
  AND created_at >= NOW() - INTERVAL '30 days'; -- Only recent users