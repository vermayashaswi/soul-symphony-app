-- Fix timezone detection for existing users and add country field for pricing
UPDATE profiles 
SET timezone = 'Asia/Kolkata'
WHERE email = 'yashaswi.verma15@iimranchi.ac.in' 
AND (timezone = 'UTC' OR timezone IS NULL);

-- Add country field to profiles table for location-specific pricing (using proper size)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'DEFAULT';

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