-- Critical Security Fixes Migration
-- Phase 1: Database Security Hardening

-- 1. Fix profiles_backup table - Add RLS policies
ALTER TABLE public.profiles_backup ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for profiles_backup (admin only access)
CREATE POLICY "Admin only access to profiles backup" 
ON public.profiles_backup 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND subscription_tier = 'admin'
  )
);

-- 2. Fix execute_dynamic_query function - Add security definer and search path
CREATE OR REPLACE FUNCTION public.execute_dynamic_query(query_text text, param_values text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- 3. Fix other security definer functions - Add proper search path
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Set trial period to 14 days from now (updated from 7 days)
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
    NEW.subscription_status = 'trial';
    NEW.subscription_tier = 'premium'; -- Fixed: Set to premium during trial
    NEW.is_premium = true; -- Grant premium access during trial
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_trial_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. Restrict anonymous access to sensitive tables
-- Revoke anonymous access to api_usage
REVOKE ALL ON public.api_usage FROM anon;

-- Revoke anonymous access to openai_usage  
REVOKE ALL ON public.openai_usage FROM anon;

-- Revoke anonymous access to user_sessions
REVOKE ALL ON public.user_sessions FROM anon;

-- 5. Add rate limiting protections
CREATE OR REPLACE FUNCTION public.enhanced_check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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