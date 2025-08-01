-- Fix the specific user's location data
UPDATE profiles 
SET 
  timezone = 'Asia/Kolkata',
  country = 'IN',
  updated_at = NOW()
WHERE id = '9662233d-35e4-4016-8644-05a423fc6d15'
  AND (country = 'DEFAULT' OR timezone = 'UTC');

-- Verify the update
SELECT id, email, country, timezone, updated_at 
FROM profiles 
WHERE id = '9662233d-35e4-4016-8644-05a423fc6d15';