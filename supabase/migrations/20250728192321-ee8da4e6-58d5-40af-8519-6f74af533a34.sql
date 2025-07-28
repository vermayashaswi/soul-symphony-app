-- Fix timezone detection for existing users and add country field for pricing
UPDATE profiles 
SET timezone = COALESCE(
  CASE 
    WHEN timezone = 'UTC' OR timezone IS NULL THEN 'Asia/Kolkata'
    ELSE timezone
  END, 
  'UTC'
) 
WHERE email = 'yashaswi.verma15@iimranchi.ac.in';

-- Add country field to profiles table for location-specific pricing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country VARCHAR(3) DEFAULT 'DEFAULT';

-- Update country for the specific user based on email domain pattern
UPDATE profiles 
SET country = 'IN'
WHERE email LIKE '%@iimranchi.ac.in';

-- Create index for efficient country-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);

-- Update other Indian users based on common patterns
UPDATE profiles 
SET country = 'IN'
WHERE country = 'DEFAULT' 
AND (email LIKE '%.in' OR email LIKE '%@gmail.com' OR email LIKE '%@yahoo.in')
AND timezone IN ('Asia/Kolkata', 'Asia/Calcutta');