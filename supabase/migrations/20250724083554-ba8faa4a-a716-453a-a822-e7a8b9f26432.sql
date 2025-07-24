-- Phase 2 (continued): Fix remaining function search paths without vector dependencies

CREATE OR REPLACE FUNCTION public.log_api_usage(p_user_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_function_name text DEFAULT NULL::text, p_endpoint text DEFAULT NULL::text, p_request_method text DEFAULT 'POST'::text, p_status_code integer DEFAULT NULL::integer, p_response_time_ms integer DEFAULT NULL::integer, p_tokens_used integer DEFAULT NULL::integer, p_cost_usd numeric DEFAULT NULL::numeric, p_rate_limit_hit boolean DEFAULT false, p_rate_limit_type text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_referer text DEFAULT NULL::text, p_request_payload_size integer DEFAULT NULL::integer, p_response_payload_size integer DEFAULT NULL::integer, p_error_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid, p_ip_address inet, p_function_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.auto_start_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.verify_phone_code(p_phone_number text, p_code text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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