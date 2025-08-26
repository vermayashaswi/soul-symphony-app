-- Fix the specific user's timezone from UTC to Asia/Kolkata based on their country (IN)
UPDATE profiles 
SET timezone = 'Asia/Kolkata', updated_at = NOW()
WHERE id = '1e7caad7-180d-439c-abd4-2f0d45256f68' 
  AND country = 'IN' 
  AND timezone = 'UTC';