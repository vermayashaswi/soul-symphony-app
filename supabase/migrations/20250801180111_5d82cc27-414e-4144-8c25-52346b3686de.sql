-- Enable RLS on tables that have policies but RLS disabled
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Fix the auto_start_trial function search path issue
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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