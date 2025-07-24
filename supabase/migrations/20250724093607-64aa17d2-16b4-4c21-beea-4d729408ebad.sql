-- Phase 1: Fix the auto_start_trial trigger function with proper error handling
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
    -- Set trial period with safe defaults
    NEW.trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL;
    NEW.subscription_status = COALESCE(NEW.subscription_status, 'trial');
    NEW.subscription_tier = COALESCE(NEW.subscription_tier, 'premium');
    NEW.is_premium = COALESCE(NEW.is_premium, true);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't block profile creation
  RAISE WARNING 'Trial setup failed for user %, error: %, setting defaults', NEW.id, SQLERRM;
  
  -- Set safe defaults if trial setup fails
  NEW.trial_ends_at = NULL;
  NEW.subscription_status = 'free';
  NEW.subscription_tier = 'free';
  NEW.is_premium = false;
  
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