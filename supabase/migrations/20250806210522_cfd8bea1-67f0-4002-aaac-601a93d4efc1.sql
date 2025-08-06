-- Fix the specific user's country field
UPDATE profiles 
SET country = 'IN', updated_at = NOW()
WHERE id = '3300254e-73db-4af5-af22-eea8fb0fe5db' AND country = 'DEFAULT';