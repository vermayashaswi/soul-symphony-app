-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert new profile for the user
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    subscription_status,
    subscription_tier,
    is_premium,
    trial_ends_at,
    tutorial_completed,
    tutorial_step,
    onboarding_completed,
    country,
    timezone,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'trial',
    'premium',
    true,
    NOW() + INTERVAL '14 days',
    'NO',
    0,
    false,
    COALESCE(NEW.raw_user_meta_data ->> 'country', 'DEFAULT'),
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC'),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table to automatically create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();