-- Create optimized functions and indexes - Part 5
-- First create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_profile_optimized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only process INSERT operations for new profiles
  IF TG_OP = 'INSERT' THEN
    -- Set optimized trial defaults
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium';
    NEW.is_premium = true;
    NEW.onboarding_completed = COALESCE(NEW.onboarding_completed, false);
    
    -- Ensure timestamps are set
    IF NEW.created_at IS NULL THEN
      NEW.created_at = NOW();
    END IF;
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the indexes
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status 
ON public.profiles(subscription_status) 
WHERE subscription_status IN ('trial', 'active');

CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at 
ON public.profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created 
ON "Journal Entries"(user_id, created_at DESC);

-- Replace the existing trigger
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS handle_new_profile ON public.profiles;

CREATE TRIGGER on_profile_created_optimized
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_optimized();