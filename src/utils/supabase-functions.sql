
-- This file contains SQL functions that need to be run in Supabase SQL editor
-- to enable the profile creation functionality

-- Function to create a profile without type issues
CREATE OR REPLACE FUNCTION create_profile(
  user_id UUID,
  user_email TEXT DEFAULT NULL,
  user_full_name TEXT DEFAULT NULL,
  user_avatar_url TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_profile JSONB;
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (user_id, user_email, user_full_name, user_avatar_url)
  RETURNING to_jsonb(profiles.*) INTO new_profile;
  
  RETURN new_profile;
EXCEPTION
  WHEN unique_violation THEN
    -- Return existing profile if there's a conflict
    SELECT to_jsonb(profiles.*) INTO new_profile
    FROM profiles
    WHERE id = user_id;
    
    RETURN new_profile;
END;
$$;
