-- Create optimized functions and indexes - Part 4
-- 6. Add indexes for better performance (without CONCURRENTLY)
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