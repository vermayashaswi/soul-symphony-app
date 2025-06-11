
-- Create api_usage table for comprehensive logging and rate limiting
CREATE TABLE public.api_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  function_name TEXT NOT NULL,
  endpoint TEXT,
  request_method TEXT DEFAULT 'POST',
  status_code INTEGER,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),
  rate_limit_hit BOOLEAN DEFAULT false,
  rate_limit_type TEXT, -- 'user', 'ip', 'openai'
  user_agent TEXT,
  referer TEXT,
  request_payload_size INTEGER,
  response_payload_size INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient rate limiting queries
CREATE INDEX idx_api_usage_user_id_created_at ON public.api_usage(user_id, created_at DESC);
CREATE INDEX idx_api_usage_ip_created_at ON public.api_usage(ip_address, created_at DESC);
CREATE INDEX idx_api_usage_function_created_at ON public.api_usage(function_name, created_at DESC);
CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at DESC);

-- Create rate_limit_config table for dynamic configuration
CREATE TABLE public.rate_limit_config (
  id SERIAL PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('user', 'ip', 'global')),
  function_name TEXT, -- NULL means applies to all functions
  requests_per_minute INTEGER,
  requests_per_hour INTEGER,
  requests_per_day INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default rate limiting rules
INSERT INTO public.rate_limit_config (rule_name, limit_type, function_name, requests_per_minute, requests_per_hour, requests_per_day) VALUES
('user_default', 'user', NULL, 5, 100, 1000),
('ip_default', 'ip', NULL, 10, 200, 2000),
('user_chat', 'user', 'chat-with-rag', 3, 50, 500),
('ip_chat', 'ip', 'chat-with-rag', 5, 100, 1000);

-- Create OpenAI usage tracking table
CREATE TABLE public.openai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  function_name TEXT,
  request_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for OpenAI usage tracking
CREATE INDEX idx_openai_usage_user_id_created_at ON public.openai_usage(user_id, created_at DESC);
CREATE INDEX idx_openai_usage_created_at ON public.openai_usage(created_at DESC);

-- Add Row Level Security
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for api_usage (users can only see their own data)
CREATE POLICY "Users can view their own API usage" 
  ON public.api_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Service role can manage everything for monitoring
CREATE POLICY "Service role can manage api_usage" 
  ON public.api_usage 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Rate limit config is read-only for authenticated users
CREATE POLICY "Authenticated users can view rate limit config" 
  ON public.rate_limit_config 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Service role can manage rate limit config
CREATE POLICY "Service role can manage rate limit config" 
  ON public.rate_limit_config 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- OpenAI usage policies
CREATE POLICY "Users can view their own OpenAI usage" 
  ON public.openai_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage openai_usage" 
  ON public.openai_usage 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_ip_address INET,
  p_function_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_function_name TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_request_method TEXT DEFAULT 'POST',
  p_status_code INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_cost_usd DECIMAL DEFAULT NULL,
  p_rate_limit_hit BOOLEAN DEFAULT false,
  p_rate_limit_type TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referer TEXT DEFAULT NULL,
  p_request_payload_size INTEGER DEFAULT NULL,
  p_response_payload_size INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION log_api_usage TO authenticated, anon, service_role;
