-- Revert problematic changes made after July 24th, 1 PM

-- 1. Remove the restrictive RLS policy from profiles_backup table
DROP POLICY IF EXISTS "Service role can access profiles_backup" ON public.profiles_backup;

-- 2. Restore execute_dynamic_query function to previous state (remove restrictive validation)
CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, param_values text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result JSONB;
  query_with_params text;
  i int;
  current_timestamp timestamp with time zone := now();
  last_month_start timestamp with time zone := date_trunc('month', current_timestamp - interval '1 month');
  last_month_end timestamp with time zone := date_trunc('month', current_timestamp) - interval '1 microsecond';
  current_month_start timestamp with time zone := date_trunc('month', current_timestamp);
  last_week_start timestamp with time zone := date_trunc('week', current_timestamp - interval '1 week');
  last_week_end timestamp with time zone := date_trunc('week', current_timestamp) - interval '1 microsecond';
  current_user_id uuid := auth.uid();
BEGIN
  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Replace time variables in the query
  query_text := replace(query_text, '__LAST_MONTH_START__', quote_literal(last_month_start));
  query_text := replace(query_text, '__LAST_MONTH_END__', quote_literal(last_month_end));
  query_text := replace(query_text, '__CURRENT_MONTH_START__', quote_literal(current_month_start));
  query_text := replace(query_text, '__LAST_WEEK_START__', quote_literal(last_week_start));
  query_text := replace(query_text, '__LAST_WEEK_END__', quote_literal(last_week_end));
  query_text := replace(query_text, '__USER_ID__', quote_literal(current_user_id));
  
  -- Start with the original query
  query_with_params := query_text;
  
  -- Replace each parameter placeholder ($1, $2, etc) with the actual value
  FOR i IN 1..array_length(param_values, 1) LOOP
    query_with_params := replace(query_with_params, '$' || i::text, quote_literal(param_values[i]));
  END LOOP;
  
  -- Execute the query
  BEGIN
    EXECUTE 'SELECT to_jsonb(array_agg(row_to_json(t)))
            FROM (' || query_with_params || ') t'
    INTO result;
    
    IF result IS NULL THEN
      result := '[]'::jsonb;
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'code', SQLSTATE
      );
  END;
END;
$function$;

-- 3. Remove SET search_path = '' from functions and restore to 'public'
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

CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  user_profile RECORD;
  result jsonb;
  is_trial_active boolean := false;
  auth_context_user_id uuid;
BEGIN
  -- Debug: Check auth context
  SELECT auth.uid() INTO auth_context_user_id;
  
  RAISE NOTICE 'get_user_subscription_status called - Param: %, Auth context: %', user_id_param, auth_context_user_id;
  
  -- Verify auth context matches parameter
  IF auth_context_user_id != user_id_param THEN
    RAISE NOTICE 'Auth context mismatch - Expected: %, Got: %', user_id_param, auth_context_user_id;
    RETURN jsonb_build_object(
      'error', 'Authentication mismatch',
      'subscription_status', 'free',
      'subscription_tier', 'free',
      'is_premium', false,
      'trial_ends_at', null,
      'is_trial_active', false
    );
  END IF;
  
  -- Get user profile with subscription data
  SELECT 
    subscription_status,
    subscription_tier,
    is_premium,
    trial_ends_at,
    created_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- Enhanced logging
  RAISE NOTICE 'Profile found: %, Status: %, Tier: %, Premium: %, Trial ends: %', 
    user_profile IS NOT NULL,
    user_profile.subscription_status,
    user_profile.subscription_tier,
    user_profile.is_premium,
    user_profile.trial_ends_at;
  
  -- If no profile found, return default values
  IF user_profile IS NULL THEN
    RAISE NOTICE 'No profile found for user %', user_id_param;
    RETURN jsonb_build_object(
      'subscription_status', 'free',
      'subscription_tier', 'free',
      'is_premium', false,
      'trial_ends_at', null,
      'is_trial_active', false
    );
  END IF;
  
  -- Check if trial is still active
  IF user_profile.trial_ends_at IS NOT NULL THEN
    is_trial_active := user_profile.trial_ends_at > NOW();
    RAISE NOTICE 'Trial check - Ends at: %, Now: %, Active: %', 
      user_profile.trial_ends_at, NOW(), is_trial_active;
  END IF;
  
  -- Build and return result
  result := jsonb_build_object(
    'subscription_status', COALESCE(user_profile.subscription_status, 'free'),
    'subscription_tier', COALESCE(user_profile.subscription_tier, 'free'),
    'is_premium', COALESCE(user_profile.is_premium, false),
    'trial_ends_at', user_profile.trial_ends_at,
    'is_trial_active', is_trial_active
  );
  
  RAISE NOTICE 'Returning result: %', result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_trial_eligible(user_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
  RETURN (
    user_profile.trial_ends_at IS NULL AND
    COALESCE(user_profile.subscription_status, 'free') = 'free'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Close expired sessions
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, NOW()),
    session_duration = COALESCE(session_duration, NOW() - session_start)
  WHERE 
    is_active = true 
    AND session_timeout < NOW();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
 RETURNS TABLE(emotion text, score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    WHERE 
      entries.user_id = user_id_param
      AND entries.emotions IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  aggregated_emotions AS (
    SELECT
      emotion_name as emotion,
      AVG(emotion_score) as avg_score,
      COUNT(*) as occurrence_count
    FROM
      emotion_data
    GROUP BY
      emotion_name
    ORDER BY
      avg_score DESC,
      occurrence_count DESC
    LIMIT limit_count
  )
  SELECT 
    emotion,
    ROUND(avg_score::numeric, 2) as score
  FROM 
    aggregated_emotions;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions_by_chunks(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
 RETURNS TABLE(emotion text, score numeric, sample_chunks jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score,
      entries.id,
      chunks.content as chunk_content,
      chunks.id as chunk_id,
      chunks.chunk_index,
      entries.created_at
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    JOIN
      journal_chunks chunks ON entries.id = chunks.journal_entry_id
    WHERE 
      entries.user_id = user_id_param::text  -- Fixed: Cast the parameter to text instead of the column
      AND entries.emotions IS NOT NULL
      AND entries.is_chunked = true
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  top_chunks_per_emotion AS (
    SELECT
      emotion_name,
      id as entry_id,
      chunk_id,
      chunk_content,
      created_at,
      emotion_score,
      chunk_index,
      ROW_NUMBER() OVER (PARTITION BY emotion_name ORDER BY emotion_score DESC, created_at DESC) as rank
    FROM
      emotion_data
  ),
  sample_chunks AS (
    SELECT
      emotion_name,
      jsonb_agg(
        jsonb_build_object(
          'entry_id', entry_id,
          'chunk_id', chunk_id,
          'content', chunk_content,
          'created_at', created_at,
          'score', emotion_score,
          'chunk_index', chunk_index
        )
      ) as chunks_json
    FROM
      top_chunks_per_emotion
    WHERE
      rank <= 3
    GROUP BY
      emotion_name
  ),
  aggregated_emotions AS (
    SELECT
      emotion_name as emotion,
      AVG(emotion_score) as avg_score,
      COUNT(*) as occurrence_count
    FROM
      emotion_data
    GROUP BY
      emotion_name
    ORDER BY
      avg_score DESC,
      occurrence_count DESC
    LIMIT limit_count
  )
  SELECT 
    ae.emotion,
    ROUND(ae.avg_score::numeric, 2) as score,
    COALESCE(sc.chunks_json, '[]'::jsonb) as sample_chunks
  FROM 
    aggregated_emotions ae
  LEFT JOIN
    sample_chunks sc ON ae.emotion = sc.emotion_name;
END;
$function$;