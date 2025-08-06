-- Update auto_start_trial function to properly set country field from user metadata
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
    
    -- Set country from user metadata if available, otherwise use 'DEFAULT'
    NEW.country = COALESCE(
      NEW.raw_user_meta_data ->> 'country',
      'DEFAULT'
    );
    
    -- Ensure tutorial setup for new users
    NEW.tutorial_completed = 'NO';
    NEW.tutorial_step = 0;
    NEW.onboarding_completed = false;
  END IF;
  
  RETURN NEW;
END;
$function$;