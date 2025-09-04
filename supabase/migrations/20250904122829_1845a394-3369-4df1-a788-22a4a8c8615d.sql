-- Add profile onboarding completion flag and detailed profile columns
ALTER TABLE public.profiles 
ADD COLUMN profile_onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN age INTEGER,
ADD COLUMN interests TEXT[],
ADD COLUMN gender TEXT,
ADD COLUMN place TEXT,
ADD COLUMN profession TEXT,
ADD COLUMN hobbies TEXT[],
ADD COLUMN likes TEXT[],
ADD COLUMN dislikes TEXT[],
ADD COLUMN others TEXT;