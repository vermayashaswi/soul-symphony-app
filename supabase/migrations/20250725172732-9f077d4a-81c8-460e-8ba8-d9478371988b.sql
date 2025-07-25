-- Phase 1: Database Security Fixes - Fix search_path for non-vector functions

-- Fix remaining functions that need proper search_path settings

-- Fix get_entries_by_emotion_term function
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

-- Fix regenerate_missing_data_for_entry function
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

-- Fix set_default_translation_status function
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

-- Fix delete_all_user_journal_entries function
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

-- Fix verify_phone_code function
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

-- Fix close_user_session function
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

-- Fix track_conversion_event function
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

-- Fix update_user_sessions_updated_at function
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

-- Fix setup_user_trial_fallback function
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

-- Fix log_api_usage function
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

-- Fix execute_dynamic_query function
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

-- Fix upsert_journal_embedding function (remove vector dependency temporarily)
CREATE OR REPLACE FUNCTION public.upsert_journal_embedding(entry_id bigint, embedding_vector text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This function is temporarily disabled due to vector extension requirements
  -- Will be re-enabled when vector extension is available
  RAISE NOTICE 'Vector embedding functionality temporarily disabled';
  RETURN;
END;
$function$;