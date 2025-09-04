-- First, check if the trigger exists and recreate it if missing
-- This trigger should automatically create a profile when a new user signs up

-- Drop the trigger if it exists (to avoid errors)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger to call handle_new_user when a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Now create a profile for the test user yashaswiverma15@iimranchi.ac.in
-- First, let's find their user ID
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  display_name,
  avatar_url,
  profile_onboarding_completed,
  onboarding_completed,
  created_at,
  updated_at
) 
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'),
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data->>'avatar_url',
  false, -- Profile onboarding not completed
  false, -- Regular onboarding not completed  
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email = 'yashaswiverma15@iimranchi.ac.in'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
  );