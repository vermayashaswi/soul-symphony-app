-- Remove phone authentication tables and related functionality
DROP TABLE IF EXISTS phone_verifications CASCADE;

-- Remove phone-related columns from profiles table
ALTER TABLE profiles 
DROP COLUMN IF EXISTS phone_number,
DROP COLUMN IF EXISTS phone_verified,
DROP COLUMN IF EXISTS phone_verified_at;