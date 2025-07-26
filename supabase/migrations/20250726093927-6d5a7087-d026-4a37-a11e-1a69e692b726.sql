-- Update existing users to have onboarding_completed = true
-- This fixes the issue where existing users show as having incomplete onboarding
UPDATE profiles 
SET onboarding_completed = true 
WHERE onboarding_completed IS NULL OR onboarding_completed = false;