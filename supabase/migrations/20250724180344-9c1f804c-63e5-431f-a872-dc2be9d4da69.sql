-- Critical Function Recovery: Create missing subscription functions

-- 1. Create get_user_subscription_status function
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  user_profile RECORD;
  result jsonb;
BEGIN
  -- Get user profile with subscription data
  SELECT 
    subscription_status,
    subscription_tier,
    is_premium,
    trial_ends_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- If no profile found, return default values
  IF user_profile IS NULL THEN
    RETURN jsonb_build_object(
      'subscription_status', 'free',
      'subscription_tier', 'free',
      'is_premium', false,
      'trial_ends_at', null,
      'is_trial_active', false
    );
  END IF;
  
  -- Check if trial is still active
  DECLARE
    is_trial_active boolean := false;
  BEGIN
    IF user_profile.trial_ends_at IS NOT NULL THEN
      is_trial_active := user_profile.trial_ends_at > NOW();
    END IF;
  END;
  
  -- Build and return result
  result := jsonb_build_object(
    'subscription_status', COALESCE(user_profile.subscription_status, 'free'),
    'subscription_tier', COALESCE(user_profile.subscription_tier, 'free'),
    'is_premium', COALESCE(user_profile.is_premium, false),
    'trial_ends_at', user_profile.trial_ends_at,
    'is_trial_active', is_trial_active
  );
  
  RETURN result;
END;
$function$;

-- 2. Create is_trial_eligible function
CREATE OR REPLACE FUNCTION public.is_trial_eligible(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get user profile
  SELECT 
    subscription_status,
    trial_ends_at,
    created_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- If no profile found, not eligible
  IF user_profile IS NULL THEN
    RETURN false;
  END IF;
  
  -- User is eligible for trial if:
  -- 1. They have never had a trial (trial_ends_at is null)
  -- 2. Their current status is 'free'
  -- 3. They are not currently in an active trial
  RETURN (
    user_profile.trial_ends_at IS NULL AND
    COALESCE(user_profile.subscription_status, 'free') = 'free'
  );
END;
$function$;

-- 3. Create cleanup_expired_trials function
CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  updated_count integer;
BEGIN
  -- Update expired trials to free status
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    subscription_tier = 'free',
    is_premium = false,
    updated_at = NOW()
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', format('Updated %s expired trials to free status', updated_count)
  );
END;
$function$;

-- 4. Security Hardening: Update existing functions with proper security
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = COALESCE(NEW.subscription_status, 'trial');
    NEW.subscription_tier = COALESCE(NEW.subscription_tier, 'premium');
    NEW.is_premium = COALESCE(NEW.is_premium, true);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't block profile creation
  RAISE WARNING 'Trial setup failed for user %, error: %, setting defaults', NEW.id, SQLERRM;
  
  -- Set safe defaults if trial setup fails
  NEW.trial_ends_at = NULL;
  NEW.subscription_status = 'free';
  NEW.subscription_tier = 'free';
  NEW.is_premium = false;
  
  RETURN NEW;
END;
$function$;

-- 5. Update other critical functions with security hardening
CREATE OR REPLACE FUNCTION public.match_journal_entries(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid)
RETURNS TABLE(id bigint, content text, similarity double precision, embedding extensions.vector, created_at timestamp with time zone, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    je.journal_entry_id AS id,
    je.content,
    1 - (je.embedding <=> query_embedding) AS similarity,
    je.embedding,
    entries.created_at,
    entries.master_themes,
    entries.emotions
  FROM
    journal_embeddings je
  JOIN
    "Journal Entries" entries ON je.journal_entry_id = entries.id
  WHERE 
    1 - (je.embedding <=> query_embedding) > match_threshold
    AND entries.user_id = user_id_filter
  ORDER BY
    je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_all_user_journal_entries(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  deleted_count integer;
  embedding_count integer;
BEGIN
  -- Ensure the user is authenticated and can only delete their own entries
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Delete embeddings first (due to foreign key relationships)
  DELETE FROM journal_embeddings 
  WHERE journal_entry_id IN (
    SELECT id FROM "Journal Entries" 
    WHERE user_id = p_user_id
  );
  
  GET DIAGNOSTICS embedding_count = ROW_COUNT;

  -- Delete all journal entries for the user
  DELETE FROM "Journal Entries" 
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_entries', deleted_count,
    'deleted_embeddings', embedding_count
  );
END;
$function$;