
-- Create table for storing phone verification requests
CREATE TABLE public.phone_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3
);

-- Add indexes for performance
CREATE INDEX idx_phone_verifications_phone_number ON public.phone_verifications(phone_number);
CREATE INDEX idx_phone_verifications_user_id ON public.phone_verifications(user_id);
CREATE INDEX idx_phone_verifications_expires_at ON public.phone_verifications(expires_at);

-- Add phone number column to profiles table for storing verified phone numbers
ALTER TABLE public.profiles 
ADD COLUMN phone_number TEXT,
ADD COLUMN phone_verified BOOLEAN DEFAULT false,
ADD COLUMN phone_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for phone number lookups
CREATE INDEX idx_profiles_phone_number ON public.profiles(phone_number);

-- Enable RLS on phone_verifications table
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for phone_verifications
CREATE POLICY "Users can view their own phone verifications" 
  ON public.phone_verifications 
  FOR SELECT 
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create phone verifications" 
  ON public.phone_verifications 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own phone verifications" 
  ON public.phone_verifications 
  FOR UPDATE 
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Create function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_phone_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.phone_verifications 
  WHERE expires_at < NOW();
END;
$$;

-- Create function to validate phone verification
CREATE OR REPLACE FUNCTION verify_phone_code(
  p_phone_number TEXT,
  p_code TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create function to check rate limiting for SMS sends
CREATE OR REPLACE FUNCTION check_sms_rate_limit(
  p_phone_number TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
