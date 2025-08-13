-- Security Fix: Remove anonymous access to user_sessions table
-- Only allow users to access their own authenticated sessions

-- Drop existing policies that allow anonymous access
DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON user_sessions;

-- Create new restrictive policies that only allow authenticated users to access their own data
CREATE POLICY "Authenticated users can view their own sessions" 
ON user_sessions 
FOR SELECT 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Authenticated users can insert their own sessions" 
ON user_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Authenticated users can update their own sessions" 
ON user_sessions 
FOR UPDATE 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Authenticated users can delete their own sessions" 
ON user_sessions 
FOR DELETE 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Clean up any existing anonymous session data for security
DELETE FROM user_sessions WHERE user_id IS NULL;