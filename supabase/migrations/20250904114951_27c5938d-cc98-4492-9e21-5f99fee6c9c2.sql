-- Remove voice onboarding columns from profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS onboarding_data,
DROP COLUMN IF EXISTS voice_onboarding_completed;