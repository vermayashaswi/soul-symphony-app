-- Add onboarding data field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN onboarding_data JSONB DEFAULT NULL,
ADD COLUMN voice_onboarding_completed BOOLEAN DEFAULT FALSE;