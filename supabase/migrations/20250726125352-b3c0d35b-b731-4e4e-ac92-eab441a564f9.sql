-- Drop existing functions to allow updates
DROP FUNCTION IF EXISTS public.cleanup_expired_trials();

-- Create optimized functions - Part 3
-- 3. Optimize expired trial cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only update trials that are actually expired and still marked as trial
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    subscription_tier = 'free',
    is_premium = false,
    updated_at = NOW()
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND is_premium = true; -- Only update if currently premium
END;
$$;

-- 5. Create optimized journal entries query function
CREATE OR REPLACE FUNCTION public.get_user_journal_entries_optimized(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id bigint,
  content text,
  created_at timestamp with time zone,
  emotions jsonb,
  themes text[],
  master_themes text[],
  sentiment text,
  audio_url text,
  duration numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    je.id,
    COALESCE(je."refined text", je."transcription text", '') as content,
    je.created_at,
    je.emotions,
    je.themes,
    je.master_themes,
    je.sentiment,
    je.audio_url,
    je.duration
  FROM "Journal Entries" je
  WHERE je.user_id = p_user_id
  ORDER BY je.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 6. Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_subscription_status 
ON public.profiles(subscription_status) 
WHERE subscription_status IN ('trial', 'active');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_trial_ends_at 
ON public.profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_user_created 
ON "Journal Entries"(user_id, created_at DESC);

-- 7. Update trigger for automatic profile creation
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