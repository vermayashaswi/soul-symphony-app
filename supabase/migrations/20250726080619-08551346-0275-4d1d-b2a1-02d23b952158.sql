-- Clean up redundant triggers on profiles table
-- This fixes the blocking loader issue caused by multiple conflicting triggers

-- Drop all redundant triggers first
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON public.profiles;
DROP TRIGGER IF EXISTS auto_trial_trigger ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_start_trial ON public.profiles;
DROP TRIGGER IF EXISTS trigger_auto_start_trial ON public.profiles;
DROP TRIGGER IF EXISTS validate_profile_creation_trigger ON public.profiles;

-- Drop the conflicting validation function
DROP FUNCTION IF EXISTS public.validate_profile_creation();

-- Create a single, efficient trigger for profile creation and trial setup
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process INSERT operations for new profiles
  IF TG_OP = 'INSERT' THEN
    -- Validate that the user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot create profile for non-existent user';
    END IF;
    
    -- Set trial period to 14 days from now
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium';
    NEW.is_premium = true;
    
    -- Ensure timestamps are set
    IF NEW.created_at IS NULL THEN
      NEW.created_at = NOW();
    END IF;
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the single trigger for profile creation
CREATE TRIGGER handle_new_profile_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile();

-- Update existing trial users that might have incorrect tier (from the database-fixes.sql)
UPDATE public.profiles 
SET 
  subscription_tier = 'premium',
  updated_at = NOW()
WHERE 
  subscription_status = 'trial' 
  AND is_premium = true 
  AND subscription_tier = 'free';

-- Create an updated_at trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();