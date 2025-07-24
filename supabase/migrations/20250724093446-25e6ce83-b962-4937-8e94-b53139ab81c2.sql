-- Phase 1: Fix the auto_start_trial trigger function
-- The current function may be failing due to security context issues

-- First, let's create a more robust auto_start_trial function
CREATE OR REPLACE FUNCTION public.auto_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trial_duration_days INTEGER := 14;
BEGIN
  -- Only set trial for new users (not updates)
  IF TG_OP = 'INSERT' THEN
    BEGIN
      -- Set trial period with error handling
      NEW.trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL;
      NEW.subscription_status = 'trial';
      NEW.subscription_tier = 'premium';
      NEW.is_premium = true;
      
      -- Log successful trial setup
      RAISE NOTICE 'Trial setup successful for user: %', NEW.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't block profile creation
      RAISE WARNING 'Trial setup failed for user %, error: %', NEW.id, SQLERRM;
      
      -- Set safe defaults if trial setup fails
      NEW.trial_ends_at = NULL;
      NEW.subscription_status = 'free';
      NEW.subscription_tier = 'free';
      NEW.is_premium = false;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a fallback function for manual trial setup
CREATE OR REPLACE FUNCTION public.setup_user_trial_fallback(user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trial_duration_days INTEGER := 14;
  result JSONB;
BEGIN
  -- Update user profile with trial settings
  UPDATE public.profiles 
  SET 
    trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL,
    subscription_status = 'trial',
    subscription_tier = 'premium',
    is_premium = true,
    updated_at = NOW()
  WHERE id = user_id;
  
  IF FOUND THEN
    result := jsonb_build_object(
      'success', true,
      'message', 'Trial setup completed',
      'trial_ends_at', (NOW() + (trial_duration_days || ' days')::INTERVAL)
    );
  ELSE
    result := jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Create a function to safely create profiles with retries
CREATE OR REPLACE FUNCTION public.create_profile_with_fallback(
  p_user_id UUID,
  p_email TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
  retry_count INTEGER := 0;
  max_retries INTEGER := 3;
BEGIN
  -- Retry loop for profile creation
  WHILE retry_count < max_retries LOOP
    BEGIN
      -- Attempt to create profile
      INSERT INTO public.profiles (
        id, email, full_name, avatar_url, timezone, created_at, updated_at
      ) VALUES (
        p_user_id, p_email, p_full_name, p_avatar_url, 
        COALESCE(p_timezone, 'UTC'), NOW(), NOW()
      );
      
      -- If successful, return success
      result := jsonb_build_object(
        'success', true,
        'message', 'Profile created successfully',
        'retry_count', retry_count
      );
      
      RETURN result;
      
    EXCEPTION WHEN unique_violation THEN
      -- Profile already exists, try to update it
      UPDATE public.profiles 
      SET 
        email = COALESCE(p_email, email),
        full_name = COALESCE(p_full_name, full_name),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        timezone = COALESCE(p_timezone, timezone, 'UTC'),
        updated_at = NOW()
      WHERE id = p_user_id;
      
      result := jsonb_build_object(
        'success', true,
        'message', 'Profile updated successfully',
        'retry_count', retry_count
      );
      
      RETURN result;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error and increment retry count
      RAISE WARNING 'Profile creation attempt % failed for user %: %', 
        retry_count + 1, p_user_id, SQLERRM;
      
      retry_count := retry_count + 1;
      
      -- If this was the last retry, return error
      IF retry_count >= max_retries THEN
        result := jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'retry_count', retry_count
        );
        
        RETURN result;
      END IF;
      
      -- Brief pause before retry (not ideal in function but necessary)
      PERFORM pg_sleep(0.1);
    END;
  END LOOP;
  
  -- Should never reach here, but just in case
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Maximum retries exceeded',
    'retry_count', retry_count
  );
END;
$$;