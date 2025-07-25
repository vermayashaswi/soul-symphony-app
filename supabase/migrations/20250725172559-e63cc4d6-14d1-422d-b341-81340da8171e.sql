-- Phase 1: Database Security Fixes - Fix search_path for all functions

-- Fix send_phone_verification function
CREATE OR REPLACE FUNCTION public.send_phone_verification(p_phone_number text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  verification_code TEXT;
  rate_limit_result JSONB;
BEGIN
  -- Check rate limits
  SELECT public.check_sms_rate_limit(p_phone_number, p_user_id) INTO rate_limit_result;
  
  IF NOT (rate_limit_result->>'allowed')::boolean THEN
    RETURN rate_limit_result;
  END IF;
  
  -- Generate 6-digit code
  verification_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Store verification code with 10-minute expiry
  INSERT INTO public.phone_verifications (
    user_id, phone_number, verification_code, expires_at
  ) VALUES (
    p_user_id, p_phone_number, verification_code, NOW() + INTERVAL '10 minutes'
  );
  
  -- In production, this would integrate with SMS service
  -- For now, return the code for testing
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification code sent',
    'code', verification_code -- Remove in production
  );
END;
$function$;

-- Fix get_user_profile_with_trial function
CREATE OR REPLACE FUNCTION public.get_user_profile_with_trial(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_data RECORD;
  is_trial_active BOOLEAN := false;
  result JSONB;
BEGIN
  -- Verify user can access this profile
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Get profile with subscription info
  SELECT * INTO profile_data
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF profile_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Check trial status
  IF profile_data.trial_ends_at IS NOT NULL THEN
    is_trial_active := profile_data.trial_ends_at > NOW();
  END IF;
  
  -- Build comprehensive result
  result := jsonb_build_object(
    'id', profile_data.id,
    'email', profile_data.email,
    'full_name', profile_data.full_name,
    'display_name', profile_data.display_name,
    'avatar_url', profile_data.avatar_url,
    'subscription_status', COALESCE(profile_data.subscription_status, 'free'),
    'subscription_tier', COALESCE(profile_data.subscription_tier, 'free'),
    'is_premium', COALESCE(profile_data.is_premium, false),
    'trial_ends_at', profile_data.trial_ends_at,
    'is_trial_active', is_trial_active,
    'onboarding_completed', COALESCE(profile_data.onboarding_completed, false),
    'phone_verified', COALESCE(profile_data.phone_verified, false),
    'created_at', profile_data.created_at,
    'updated_at', profile_data.updated_at
  );
  
  RETURN result;
END;
$function$;

-- Fix enhanced_rate_limit_check function
CREATE OR REPLACE FUNCTION public.enhanced_rate_limit_check(p_user_id uuid, p_action text, p_per_minute integer DEFAULT 5, p_per_hour integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  minute_count INTEGER;
  hour_count INTEGER;
BEGIN
  -- Count actions in last minute
  SELECT COUNT(*) INTO minute_count
  FROM public.api_usage
  WHERE user_id = p_user_id
    AND function_name = p_action
    AND created_at > NOW() - INTERVAL '1 minute';
  
  -- Count actions in last hour  
  SELECT COUNT(*) INTO hour_count
  FROM public.api_usage
  WHERE user_id = p_user_id
    AND function_name = p_action
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Check limits
  IF minute_count >= p_per_minute OR hour_count >= p_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', CASE 
        WHEN minute_count >= p_per_minute THEN 'minute_limit_exceeded'
        ELSE 'hour_limit_exceeded'
      END,
      'retry_after', CASE
        WHEN minute_count >= p_per_minute THEN 60
        ELSE 3600
      END
    );
  END IF;
  
  RETURN jsonb_build_object('allowed', true);
END;
$function$;

-- Fix match_journal_entries_by_emotion function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion(emotion_name text, user_id_filter uuid, min_score double precision DEFAULT 0.3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, emotion_score double precision, embedding extensions.vector)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Fix match_journal_entries_by_theme function
CREATE OR REPLACE FUNCTION public.match_journal_entries_by_theme(theme_query text, user_id_filter uuid, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, themes text[], similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Fix cleanup_expired_phone_verifications function
CREATE OR REPLACE FUNCTION public.cleanup_expired_phone_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.phone_verifications 
  WHERE expires_at < NOW();
END;
$function$;

-- Fix get_active_themes function
CREATE OR REPLACE FUNCTION public.get_active_themes()
RETURNS TABLE(id integer, name text, description text, display_order integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.display_order
  FROM public.themes t
  WHERE t.is_active = true
  ORDER BY t.display_order ASC, t.name ASC;
END;
$function$;

-- Fix get_attribution_analytics function
CREATE OR REPLACE FUNCTION public.get_attribution_analytics(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  WITH session_stats AS (
    SELECT 
      utm_source,
      utm_medium,
      utm_campaign,
      country_code,
      COUNT(*) as session_count,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(page_views) as avg_page_views,
      jsonb_array_length(conversion_events) as total_conversions
    FROM user_sessions
    WHERE 
      (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY utm_source, utm_medium, utm_campaign, country_code
  )
  SELECT jsonb_agg(row_to_json(session_stats)) INTO result
  FROM session_stats;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;

-- Fix check_trial_expiry function
CREATE OR REPLACE FUNCTION public.check_trial_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles 
  SET 
    subscription_status = 'free',
    is_premium = false
  WHERE 
    subscription_status = 'trial' 
    AND trial_ends_at < NOW();
END;
$function$;

-- Fix insert_sample_journal_entries function
CREATE OR REPLACE FUNCTION public.insert_sample_journal_entries(target_user_id uuid)
RETURNS TABLE(inserted_id bigint, inserted_created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Fix check_sms_rate_limit function
CREATE OR REPLACE FUNCTION public.check_sms_rate_limit(p_phone_number text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_attempts INTEGER;
  last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count attempts in last hour
  SELECT COUNT(*), MAX(created_at)
  INTO recent_attempts, last_attempt
  FROM public.phone_verifications
  WHERE phone_number = p_phone_number
    AND created_at > NOW() - INTERVAL '1 hour'
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Check if rate limited (max 5 SMS per hour per phone number)
  IF recent_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'rate_limited',
      'retry_after', EXTRACT(EPOCH FROM (last_attempt + INTERVAL '1 hour' - NOW()))
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$function$;

-- Fix calculate_session_quality_score function
CREATE OR REPLACE FUNCTION public.calculate_session_quality_score(p_session_duration interval, p_page_views integer, p_crash_count integer, p_error_count integer, p_background_time interval, p_foreground_time interval)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  quality_score numeric := 1.0;
  duration_minutes numeric;
  background_ratio numeric;
BEGIN
  -- Base score starts at 1.0
  
  -- Duration factor (longer sessions are better, up to a point)
  duration_minutes := EXTRACT(EPOCH FROM p_session_duration) / 60.0;
  IF duration_minutes > 0 THEN
    quality_score := quality_score + LEAST(duration_minutes / 30.0, 2.0); -- Max +2.0 for 30+ minutes
  END IF;
  
  -- Page views factor
  IF p_page_views > 1 THEN
    quality_score := quality_score + LEAST(p_page_views * 0.1, 1.0); -- Max +1.0 for 10+ page views
  END IF;
  
  -- Crash/error penalties
  quality_score := quality_score - (p_crash_count * 0.5) - (p_error_count * 0.1);
  
  -- Background time ratio (too much background time reduces quality)
  IF p_foreground_time > interval '0' THEN
    background_ratio := EXTRACT(EPOCH FROM p_background_time) / EXTRACT(EPOCH FROM p_foreground_time);
    IF background_ratio > 2.0 THEN -- More than 2:1 background:foreground ratio
      quality_score := quality_score - (background_ratio - 2.0) * 0.2;
    END IF;
  END IF;
  
  -- Ensure score is between 0 and 5
  RETURN GREATEST(0.0, LEAST(5.0, quality_score));
END;
$function$;

-- Fix match_journal_entries function
CREATE OR REPLACE FUNCTION public.match_journal_entries(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid)
RETURNS TABLE(id bigint, content text, similarity double precision, embedding extensions.vector, created_at timestamp with time zone, themes text[], emotions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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