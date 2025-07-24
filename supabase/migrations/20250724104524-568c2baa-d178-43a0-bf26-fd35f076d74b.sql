-- Revert all security review changes

-- 1. Drop the admin-only RLS policy from profiles_backup table
DROP POLICY IF EXISTS "Admin only access to profiles backup" ON public.profiles_backup;

-- 2. Remove SECURITY DEFINER from execute_dynamic_query function
CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, param_values text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
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
  allowed_tables text[] := ARRAY['Journal Entries', 'profiles', 'user_sessions', 'chat_threads', 'chat_messages'];
  sanitized_query text;
BEGIN
  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Enhanced query validation and sanitization
  sanitized_query := lower(trim(query_text));
  
  -- Block dangerous SQL operations
  IF sanitized_query ~* '\b(drop|create|alter|grant|revoke|truncate|delete|insert|update)\b' THEN
    RETURN jsonb_build_object('error', 'Only SELECT queries are allowed');
  END IF;
  
  -- Validate table access - ensure query only accesses allowed tables
  IF NOT (sanitized_query ~* '\bfrom\s+("?(' || array_to_string(allowed_tables, '"|"') || ')"?)\b') THEN
    RETURN jsonb_build_object('error', 'Access to specified tables not permitted');
  END IF;
  
  -- Ensure user can only access their own data
  IF NOT (sanitized_query ~* '\buser_id\s*=\s*auth\.uid\(\)') THEN
    RETURN jsonb_build_object('error', 'Queries must include user_id = auth.uid() filter');
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
  
  -- Execute the query with additional safeguards
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
      -- Log the error for debugging (without exposing query details)
      RAISE NOTICE 'Error executing dynamic query: %', SQLERRM;
      
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'code', SQLSTATE
      );
  END;
END;
$function$;

-- 3. Remove SECURITY DEFINER from check_rate_limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
RETURNS jsonb
LANGUAGE plpgsql
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

-- 4. Remove SECURITY DEFINER from enhanced_check_rate_limit function
CREATE OR REPLACE FUNCTION public.enhanced_check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
RETURNS jsonb
LANGUAGE plpgsql
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

-- 5. Remove SECURITY DEFINER from get_top_emotions function and restore original parameter name
CREATE OR REPLACE FUNCTION public.get_top_emotions(user_id_param uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, limit_count integer DEFAULT 3)
RETURNS TABLE(emotion text, score numeric)
LANGUAGE plpgsql
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

-- 6. Remove SECURITY DEFINER from setup_user_trial_fallback function
CREATE OR REPLACE FUNCTION public.setup_user_trial_fallback(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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

-- 7. Remove SECURITY DEFINER from auto_start_trial function
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  trial_duration_days INTEGER := 14;
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period with safe defaults
    NEW.trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL;
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

-- 8. Restore original match_journal_entries function signature
CREATE OR REPLACE FUNCTION public.match_journal_entries(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid)
RETURNS TABLE(id bigint, content text, similarity double precision, embedding extensions.vector, created_at timestamp with time zone, themes text[], emotions jsonb)
LANGUAGE plpgsql
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

-- 9. Restore original match_journal_entries_with_date function signature
CREATE OR REPLACE FUNCTION public.match_journal_entries_with_date(query_embedding extensions.vector, match_threshold double precision, match_count integer, user_id_filter uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id bigint, content text, created_at timestamp with time zone, similarity double precision, themes text[], emotions jsonb)
LANGUAGE plpgsql
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

-- 10. Remove SET search_path from log_api_usage function
CREATE OR REPLACE FUNCTION public.log_api_usage(p_user_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_function_name text DEFAULT NULL::text, p_endpoint text DEFAULT NULL::text, p_request_method text DEFAULT 'POST'::text, p_status_code integer DEFAULT NULL::integer, p_response_time_ms integer DEFAULT NULL::integer, p_tokens_used integer DEFAULT NULL::integer, p_cost_usd numeric DEFAULT NULL::numeric, p_rate_limit_hit boolean DEFAULT false, p_rate_limit_type text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_referer text DEFAULT NULL::text, p_request_payload_size integer DEFAULT NULL::integer, p_response_payload_size integer DEFAULT NULL::integer, p_error_message text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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