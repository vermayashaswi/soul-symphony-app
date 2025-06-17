

-- Update the auto_start_trial trigger to set subscription_tier to 'premium' during trial
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

-- Also update any existing trial users that might have incorrect tier
UPDATE public.profiles 
SET 
  subscription_tier = 'premium',
  updated_at = NOW()
WHERE 
  subscription_status = 'trial' 
  AND is_premium = true 
  AND subscription_tier = 'free';

