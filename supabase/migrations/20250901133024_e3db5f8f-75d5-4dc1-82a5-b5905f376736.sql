-- Fix RLS policy for feature_flags to allow public read access
-- Feature flags are configuration data that should be readable by the application

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can view feature flags" ON feature_flags;

-- Create new policy allowing public read access to feature flags
CREATE POLICY "Public read access to feature flags" 
ON feature_flags 
FOR SELECT 
USING (true);

-- Ensure RLS is still enabled but with public read access
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;