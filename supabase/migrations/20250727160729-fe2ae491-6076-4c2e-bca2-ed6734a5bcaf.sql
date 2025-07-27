-- Complete Phase 1 Security Fixes: Fix remaining database function search paths
-- This addresses all remaining function search path vulnerabilities

-- Fix the remaining functions that don't have search_path set
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion(emotion_name text, user_id_filter uuid, min_score double precision DEFAULT 0.3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, emotion_score double precision, embedding extensions.vector)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    CAST(entries.emotions->>emotion_name AS float) as emotion_score,
    je.embedding
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.emotions IS NOT NULL 
    AND entries.emotions ? emotion_name
    AND CAST(entries.emotions->>emotion_name AS float) >= min_score
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    CAST(entries.emotions->>emotion_name AS float) DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme(theme_query text, user_id_filter uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, themes text[], similarity double precision)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- Generate an embedding for the theme query
  SELECT openai.embedding(theme_query) INTO query_embedding;
  
  -- Return entries that have master_themes and match the criteria
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at,
    entries.master_themes as themes,
    CASE 
      WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> query_embedding)
      ELSE 0.3  -- Default similarity for theme-only matches
    END AS similarity
  FROM
    "Journal Entries" entries
  LEFT JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter
    AND entries.master_themes IS NOT NULL
    AND (
      -- Direct theme matching using array operations
      theme_query = ANY(entries.master_themes)
      OR
      -- Partial theme matching (case-insensitive)
      EXISTS (
        SELECT 1 FROM unnest(entries.master_themes) as theme
        WHERE theme ILIKE '%' || theme_query || '%'
      )
      OR
      -- Semantic similarity fallback
      (je.embedding IS NOT NULL AND 1 - (je.embedding <=> query_embedding) > match_threshold)
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    -- Prioritize exact theme matches
    CASE WHEN theme_query = ANY(entries.master_themes) THEN 1 ELSE 0 END DESC,
    -- Then by similarity score
    CASE 
      WHEN je.embedding IS NOT NULL THEN 1 - (je.embedding <=> query_embedding)
      ELSE 0.3
    END DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_themes()
RETURNS TABLE(id integer, name text, description text, display_order integer)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.display_order
  FROM public.themes t
  WHERE t.is_active = true
  ORDER BY t.display_order ASC, t.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.comprehensive_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  expired_trials INTEGER := 0;
  expired_sessions INTEGER := 0;
  result JSONB;
BEGIN
  -- Clean up expired trials
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
  
  GET DIAGNOSTICS expired_trials = ROW_COUNT;
  
  -- Clean up expired sessions
  UPDATE public.user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW())
  WHERE 
    is_active = true 
    AND last_activity < NOW() - INTERVAL '24 hours';
    
  GET DIAGNOSTICS expired_sessions = ROW_COUNT;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'expired_trials_cleaned', expired_trials,
    'expired_sessions_cleaned', expired_sessions,
    'message', 'Cleanup completed'
  );
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.simple_session_manager(p_user_id uuid, p_device_type text DEFAULT NULL::text, p_entry_page text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  session_id uuid;
BEGIN
  -- Verify user authentication
  IF auth.uid() != p_user_id THEN
    RETURN NULL;
  END IF;

  -- Close any existing active sessions for this user
  UPDATE user_sessions 
  SET 
    is_active = false,
    session_end = NOW()
  WHERE 
    user_id = p_user_id 
    AND is_active = true;

  -- Create new simple session
  INSERT INTO user_sessions (
    user_id, 
    device_type, 
    entry_page,
    last_activity
  ) VALUES (
    p_user_id, 
    p_device_type, 
    p_entry_page,
    NOW()
  ) RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
RETURNS TABLE(current_tier text, current_status text, trial_end_date timestamp with time zone, is_trial_active boolean, is_premium_access boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  -- Get profile data with optimized query
  SELECT 
    COALESCE(p.subscription_tier, 'free') as tier,
    COALESCE(p.subscription_status, 'free') as status,
    p.trial_ends_at,
    COALESCE(p.is_premium, false) as premium,
    p.created_at
  INTO profile_record
  FROM profiles p
  WHERE p.id = user_id_param;
  
  -- Return immediately if no profile found
  IF profile_record IS NULL THEN
    RETURN QUERY SELECT 
      'free'::text,
      'free'::text,
      NULL::timestamp with time zone,
      false,
      false;
    RETURN;
  END IF;
  
  -- Check if trial is active (not expired)
  DECLARE
    trial_active boolean := false;
  BEGIN
    IF profile_record.trial_ends_at IS NOT NULL THEN
      trial_active := profile_record.trial_ends_at > NOW();
    END IF;
    
    RETURN QUERY SELECT 
      profile_record.tier,
      profile_record.status,
      profile_record.trial_ends_at,
      trial_active,
      profile_record.premium;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_sample_journal_entries(target_user_id uuid)
RETURNS TABLE(inserted_id bigint, inserted_created_at timestamp with time zone)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  i INTEGER;
  random_timestamp TIMESTAMP WITH TIME ZONE;
  new_id BIGINT;
BEGIN
  -- Insert 10 entries with random timestamps from the last 3 months
  FOR i IN 1..10 LOOP
    -- Generate random timestamp within last 3 months
    random_timestamp := NOW() - (RANDOM() * INTERVAL '3 months');
    
    -- Insert the entry
    INSERT INTO "Journal Entries" (user_id, created_at)
    VALUES (target_user_id, random_timestamp)
    RETURNING id, created_at INTO new_id, random_timestamp;
    
    -- Return the inserted data
    inserted_id := new_id;
    inserted_created_at := random_timestamp;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- This function is temporarily disabled due to vector extension requirements
  -- Will be re-enabled when vector extension is available
  RAISE NOTICE 'Vector embedding functionality temporarily disabled';
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid)
RETURNS TABLE(id bigint, content text, similarity double precision, embedding extensions.vector, created_at timestamp with time zone, themes text[], emotions jsonb)
LANGUAGE plpgsql
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, similarity double precision, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Log date parameters for debugging
  RAISE NOTICE 'Date filter parameters - Start: %, End: %', start_date, end_date;
  
  -- First check if date parameters are valid
  IF start_date IS NOT NULL AND end_date IS NOT NULL AND start_date > end_date THEN
    RAISE NOTICE 'Invalid date range: start_date (%) is after end_date (%)', start_date, end_date;
    -- Return empty set for invalid date range
    RETURN;
  END IF;

  -- Apply date filtering first, then vector similarity
  RETURN QUERY
  WITH date_filtered_entries AS (
    SELECT 
      entries.id,
      entries.created_at,
      je.journal_entry_id,
      je.embedding,
      entries.master_themes,
      entries.emotions,
      COALESCE(entries."refined text", entries."transcription text") AS content_text
    FROM
      "Journal Entries" entries
    JOIN
      journal_embeddings je ON je.journal_entry_id = entries.id
    WHERE 
      entries.user_id = user_id_filter
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  )
  SELECT
    dfe.journal_entry_id AS id,
    dfe.content_text AS content,
    dfe.created_at,
    1 - (dfe.embedding <=> query_embedding) AS similarity,
    dfe.master_themes,
    dfe.emotions
  FROM
    date_filtered_entries dfe
  WHERE 
    1 - (dfe.embedding <=> query_embedding) > match_threshold
  ORDER BY
    dfe.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;