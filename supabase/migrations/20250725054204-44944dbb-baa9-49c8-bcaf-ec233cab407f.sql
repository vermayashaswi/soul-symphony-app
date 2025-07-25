-- Fix Remaining Security Issues
-- Address all remaining function search path and authentication security warnings

-- 1. FIX ALL EXISTING FUNCTIONS MISSING SEARCH PATH
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

CREATE OR REPLACE FUNCTION public.check_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  AND c.table_name = $1
  ORDER BY c.ordinal_position;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_entries_by_emotion_term(emotion_term text, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 5)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    entries.id,
    COALESCE(entries."refined text", entries."transcription text") as content,
    entries.created_at
  FROM
    "Journal Entries" entries
  WHERE 
    entries.user_id = user_id_filter::text
    AND (
      (entries.emotions IS NOT NULL AND 
       EXISTS (
         SELECT 1 FROM jsonb_object_keys(entries.emotions) AS emotion_key 
         WHERE emotion_key ILIKE '%' || emotion_term || '%'
       ))
      OR 
      (entries."refined text" IS NOT NULL AND entries."refined text" ILIKE '%' || emotion_term || '%')
      OR
      (entries."transcription text" IS NOT NULL AND entries."transcription text" ILIKE '%' || emotion_term || '%')
      OR
      (entries.master_themes IS NOT NULL AND 
       EXISTS (
         SELECT 1 FROM unnest(entries.master_themes) AS theme 
         WHERE theme ILIKE '%' || emotion_term || '%'
       ))
    )
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    entries.created_at DESC
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_missing_data_for_entry(target_entry_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  entry_record RECORD;
  result jsonb := '{}';
BEGIN
  -- Get the entry details
  SELECT id, "refined text", "transcription text", user_id, sentiment, themes, master_themes, entities, emotions
  INTO entry_record
  FROM "Journal Entries"
  WHERE id = target_entry_id;
  
  IF entry_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Entry not found');
  END IF;
  
  -- Clear existing data that needs to be regenerated
  UPDATE "Journal Entries"
  SET 
    themes = NULL,
    master_themes = NULL,
    themeemotion = NULL,
    entities = NULL,
    emotions = NULL,
    sentiment = '0'
  WHERE id = target_entry_id;
  
  -- Delete existing embedding to force regeneration
  DELETE FROM journal_embeddings WHERE journal_entry_id = target_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', target_entry_id,
    'message', 'Entry data cleared for regeneration'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_default_translation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.translation_status = 'completed';
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_all_user_journal_entries(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.verify_phone_code(p_phone_number text, p_code text, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  verification_record RECORD;
  result JSONB;
BEGIN
  -- Find the verification record
  SELECT * INTO verification_record
  FROM public.phone_verifications
  WHERE phone_number = p_phone_number
    AND verification_code = p_code
    AND expires_at > NOW()
    AND verified = false
    AND (p_user_id IS NULL OR user_id = p_user_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF verification_record IS NULL THEN
    -- Check if code exists but is expired or already used
    IF EXISTS (
      SELECT 1 FROM public.phone_verifications 
      WHERE phone_number = p_phone_number AND verification_code = p_code
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'verification_expired');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
    END IF;
  END IF;

  -- Mark as verified
  UPDATE public.phone_verifications
  SET verified = true
  WHERE id = verification_record.id;

  -- Update user profile if user_id is provided
  IF verification_record.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      phone_number = p_phone_number,
      phone_verified = true,
      phone_verified_at = NOW()
    WHERE id = verification_record.user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'verified', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_user_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = NOW(),
    session_duration = NOW() - session_start
  WHERE 
    id = p_session_id 
    AND user_id = p_user_id 
    AND is_active = true;
    
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_conversion_event(p_session_id uuid, p_event_type text, p_event_data jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_event JSONB;
BEGIN
  -- Create the event object
  new_event := jsonb_build_object(
    'type', p_event_type,
    'timestamp', NOW(),
    'data', p_event_data
  );
  
  -- Add the event to the session's conversion_events array
  UPDATE user_sessions
  SET 
    conversion_events = COALESCE(conversion_events, '[]'::jsonb) || new_event,
    last_activity = NOW()
  WHERE id = p_session_id;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.setup_user_trial_fallback(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trial_duration_days INTEGER := 14;
  result JSONB;
BEGIN
  -- Update user profile with trial settings
  UPDATE public.profiles 
  SET 
    trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL,
    subscription_status = 'trial',
    subscription_tier = 'premium',
    is_premium = true,
    updated_at = NOW()
  WHERE id = user_id;
  
  IF FOUND THEN
    result := jsonb_build_object(
      'success', true,
      'message', 'Trial setup completed',
      'trial_ends_at', (NOW() + (trial_duration_days || ' days')::INTERVAL)
    );
  ELSE
    result := jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_minute_count INTEGER := 0;
  user_hour_count INTEGER := 0;
  ip_minute_count INTEGER := 0;
  ip_hour_count INTEGER := 0;
  user_minute_limit INTEGER;
  user_hour_limit INTEGER;
  ip_minute_limit INTEGER;
  ip_hour_limit INTEGER;
  result JSONB;
BEGIN
  -- Get rate limits for this function or use defaults
  SELECT 
    COALESCE(user_config.requests_per_minute, default_user.requests_per_minute) as user_min,
    COALESCE(user_config.requests_per_hour, default_user.requests_per_hour) as user_hr,
    COALESCE(ip_config.requests_per_minute, default_ip.requests_per_minute) as ip_min,
    COALESCE(ip_config.requests_per_hour, default_ip.requests_per_hour) as ip_hr
  INTO user_minute_limit, user_hour_limit, ip_minute_limit, ip_hour_limit
  FROM 
    (SELECT requests_per_minute, requests_per_hour FROM rate_limit_config WHERE rule_name = 'user_default' AND is_active = true) default_user,
    (SELECT requests_per_minute, requests_per_hour FROM rate_limit_config WHERE rule_name = 'ip_default' AND is_active = true) default_ip
  LEFT JOIN 
    (SELECT requests_per_minute, requests_per_hour FROM rate_limit_config WHERE limit_type = 'user' AND function_name = p_function_name AND is_active = true) user_config ON true
  LEFT JOIN 
    (SELECT requests_per_minute, requests_per_hour FROM rate_limit_config WHERE limit_type = 'ip' AND function_name = p_function_name AND is_active = true) ip_config ON true;

  -- Count user requests in last minute and hour
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO user_minute_count
    FROM api_usage 
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 minute';
      
    SELECT COUNT(*) INTO user_hour_count
    FROM api_usage 
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 hour';
  END IF;

  -- Count IP requests in last minute and hour
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_minute_count
    FROM api_usage 
    WHERE ip_address = p_ip_address 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 minute';
      
    SELECT COUNT(*) INTO ip_hour_count
    FROM api_usage 
    WHERE ip_address = p_ip_address 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 hour';
  END IF;

  -- Build result
  result := jsonb_build_object(
    'allowed', true,
    'user_limits', jsonb_build_object(
      'minute', jsonb_build_object('current', user_minute_count, 'limit', user_minute_limit),
      'hour', jsonb_build_object('current', user_hour_count, 'limit', user_hour_limit)
    ),
    'ip_limits', jsonb_build_object(
      'minute', jsonb_build_object('current', ip_minute_count, 'limit', ip_minute_limit),
      'hour', jsonb_build_object('current', ip_hour_count, 'limit', ip_hour_limit)
    )
  );

  -- Check if any limits are exceeded
  IF (p_user_id IS NOT NULL AND (user_minute_count >= user_minute_limit OR user_hour_count >= user_hour_limit)) OR
     (p_ip_address IS NOT NULL AND (ip_minute_count >= ip_minute_limit OR ip_hour_count >= ip_hour_limit)) THEN
    result := jsonb_set(result, '{allowed}', 'false'::jsonb);
    
    -- Determine which limit was hit
    IF user_minute_count >= user_minute_limit THEN
      result := jsonb_set(result, '{limit_type}', '"user_minute"'::jsonb);
    ELSIF user_hour_count >= user_hour_limit THEN
      result := jsonb_set(result, '{limit_type}', '"user_hour"'::jsonb);
    ELSIF ip_minute_count >= ip_minute_limit THEN
      result := jsonb_set(result, '{limit_type}', '"ip_minute"'::jsonb);
    ELSIF ip_hour_count >= ip_hour_limit THEN
      result := jsonb_set(result, '{limit_type}', '"ip_hour"'::jsonb);
    END IF;
  END IF;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_api_usage(p_user_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_function_name text DEFAULT NULL::text, p_endpoint text DEFAULT NULL::text, p_request_method text DEFAULT 'POST'::text, p_status_code integer DEFAULT NULL::integer, p_response_time_ms integer DEFAULT NULL::integer, p_tokens_used integer DEFAULT NULL::integer, p_cost_usd numeric DEFAULT NULL::numeric, p_rate_limit_hit boolean DEFAULT false, p_rate_limit_type text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_referer text DEFAULT NULL::text, p_request_payload_size integer DEFAULT NULL::integer, p_response_payload_size integer DEFAULT NULL::integer, p_error_message text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  usage_id UUID;
BEGIN
  INSERT INTO api_usage (
    user_id, ip_address, function_name, endpoint, request_method,
    status_code, response_time_ms, tokens_used, cost_usd,
    rate_limit_hit, rate_limit_type, user_agent, referer,
    request_payload_size, response_payload_size, error_message
  ) VALUES (
    p_user_id, p_ip_address, p_function_name, p_endpoint, p_request_method,
    p_status_code, p_response_time_ms, p_tokens_used, p_cost_usd,
    p_rate_limit_hit, p_rate_limit_type, p_user_agent, p_referer,
    p_request_payload_size, p_response_payload_size, p_error_message
  ) RETURNING id INTO usage_id;
  
  RETURN usage_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, param_values text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.enhanced_check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_minute_count INTEGER := 0;
  user_hour_count INTEGER := 0;
  ip_minute_count INTEGER := 0;
  ip_hour_count INTEGER := 0;
  user_minute_limit INTEGER := 10;
  user_hour_limit INTEGER := 100;
  ip_minute_limit INTEGER := 20;
  ip_hour_limit INTEGER := 200;
  result JSONB;
BEGIN
  -- Count user requests in last minute and hour
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO user_minute_count
    FROM api_usage 
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 minute';
      
    SELECT COUNT(*) INTO user_hour_count
    FROM api_usage 
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND created_at > NOW() - INTERVAL '1 hour';
  END IF;

  -- Count IP requests in last minute and hour (stricter limits)
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_minute_count
    FROM api_usage 
    WHERE ip_address = p_ip_address 
      AND created_at > NOW() - INTERVAL '1 minute';
      
    SELECT COUNT(*) INTO ip_hour_count
    FROM api_usage 
    WHERE ip_address = p_ip_address 
      AND created_at > NOW() - INTERVAL '1 hour';
  END IF;

  -- Build result
  result := jsonb_build_object(
    'allowed', true,
    'user_limits', jsonb_build_object(
      'minute', jsonb_build_object('current', user_minute_count, 'limit', user_minute_limit),
      'hour', jsonb_build_object('current', user_hour_count, 'limit', user_hour_limit)
    ),
    'ip_limits', jsonb_build_object(
      'minute', jsonb_build_object('current', ip_minute_count, 'limit', ip_minute_limit),
      'hour', jsonb_build_object('current', ip_hour_count, 'limit', ip_hour_limit)
    )
  );

  -- Check if any limits are exceeded
  IF (p_user_id IS NOT NULL AND (user_minute_count >= user_minute_limit OR user_hour_count >= user_hour_limit)) OR
     (p_ip_address IS NOT NULL AND (ip_minute_count >= ip_minute_limit OR ip_hour_count >= ip_hour_limit)) THEN
    result := jsonb_set(result, '{allowed}', 'false'::jsonb);
    
    -- Determine which limit was hit
    IF user_minute_count >= user_minute_limit THEN
      result := jsonb_set(result, '{limit_type}', '"user_minute"'::jsonb);
    ELSIF user_hour_count >= user_hour_limit THEN
      result := jsonb_set(result, '{limit_type}', '"user_hour"'::jsonb);
    ELSIF ip_minute_count >= ip_minute_limit THEN
      result := jsonb_set(result, '{limit_type}', '"ip_minute"'::jsonb);
    ELSIF ip_hour_count >= ip_hour_limit THEN
      result := jsonb_set(result, '{limit_type}', '"ip_hour"'::jsonb);
    END IF;
  END IF;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector extensions.vector)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO journal_embeddings (journal_entry_id, content, embedding)
  SELECT 
    entry_id,
    COALESCE(je."refined text", je."transcription text", '') as content,
    embedding_vector
  FROM "Journal Entries" je
  WHERE je.id = entry_id
  ON CONFLICT (journal_entry_id) 
  DO UPDATE SET 
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_journal_entries_by_emotion_strength(emotion_name text, user_id_filter uuid, match_count integer DEFAULT 3, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  JOIN
    journal_embeddings je ON entries.id = je.journal_entry_id
  WHERE 
    entries.user_id = user_id_filter::text
    AND entries.emotions IS NOT NULL 
    AND entries.emotions ? emotion_name
    AND (start_date IS NULL OR entries.created_at >= start_date)
    AND (end_date IS NULL OR entries.created_at <= end_date)
  ORDER BY
    CAST(entries.emotions->>emotion_name AS float) DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions_with_entries(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric, sample_entries jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH emotion_data AS (
    SELECT
      e.key as emotion_name,
      (e.value::numeric) as emotion_score,
      entries.id,
      COALESCE(entries."refined text", entries."transcription text") as content,
      entries.created_at
    FROM 
      "Journal Entries" entries,
      jsonb_each(entries.emotions) e
    WHERE 
      entries.user_id = user_id_param
      AND entries.emotions IS NOT NULL
      AND (start_date IS NULL OR entries.created_at >= start_date)
      AND (end_date IS NULL OR entries.created_at <= end_date)
  ),
  top_entries_per_emotion AS (
    SELECT
      emotion_name,
      id,
      content,
      created_at,
      emotion_score,
      ROW_NUMBER() OVER (PARTITION BY emotion_name ORDER BY emotion_score DESC) as rank
    FROM
      emotion_data
  ),
  sample_entries AS (
    SELECT
      emotion_name,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'content', left(content, 150),
          'created_at', created_at,
          'score', emotion_score
        )
      ) as entries_json
    FROM
      top_entries_per_emotion
    WHERE
      rank <= 2
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
    COALESCE(se.entries_json, '[]'::jsonb) as sample_entries
  FROM 
    aggregated_emotions ae
  LEFT JOIN
    sample_entries se ON ae.emotion = se.emotion_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.table_exists(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_emotions(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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