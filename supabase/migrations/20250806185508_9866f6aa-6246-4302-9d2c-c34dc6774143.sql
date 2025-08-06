-- Fix missing onboarding_completed flag for user 3300254e-73db-4af5-af22-eea8fb0fe5db
UPDATE profiles 
SET onboarding_completed = true, updated_at = now()
WHERE id = '3300254e-73db-4af5-af22-eea8fb0fe5db';