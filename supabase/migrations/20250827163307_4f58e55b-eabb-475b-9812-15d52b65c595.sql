-- Function to sync reminder settings from profiles to user_notifications with timezone conversion
CREATE OR REPLACE FUNCTION sync_reminder_settings_to_notifications(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
  reminder_key TEXT;
  reminder_data jsonb;
  reminder_time TEXT;
  reminder_enabled BOOLEAN;
  reminder_label TEXT;
  utc_time TIME;
  inserted_count INTEGER := 0;
  result jsonb;
BEGIN
  -- Get user profile with timezone and reminder settings
  SELECT timezone, reminder_settings, country
  INTO user_profile
  FROM profiles 
  WHERE id = p_user_id;
  
  IF user_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'User profile not found');
  END IF;
  
  -- Use default timezone if none set
  IF user_profile.timezone IS NULL THEN
    user_profile.timezone := 'UTC';
  END IF;
  
  -- Delete existing journal reminder notifications for this user
  DELETE FROM user_notifications 
  WHERE user_id = p_user_id AND type = 'journal_reminder';
  
  -- Process reminder settings if they exist
  IF user_profile.reminder_settings IS NOT NULL THEN
    -- Iterate through reminder settings
    FOR reminder_key, reminder_data IN SELECT * FROM jsonb_each(user_profile.reminder_settings)
    LOOP
      -- Skip if this is not a reminder object with required fields
      IF NOT (reminder_data ? 'time' AND reminder_data ? 'enabled') THEN
        CONTINUE;
      END IF;
      
      reminder_time := reminder_data->>'time';
      reminder_enabled := (reminder_data->>'enabled')::boolean;
      reminder_label := COALESCE(reminder_data->>'label', initcap(reminder_key) || ' Reminder');
      
      -- Only process enabled reminders with valid time format
      IF reminder_enabled AND reminder_time ~ '^\d{2}:\d{2}$' THEN
        -- Convert local time to UTC using timezone
        BEGIN
          -- Create a timestamp for today with the reminder time in user's timezone
          -- Then extract just the time component in UTC
          SELECT (
            (CURRENT_DATE::timestamp AT TIME ZONE user_profile.timezone + reminder_time::time)
            AT TIME ZONE user_profile.timezone 
            AT TIME ZONE 'UTC'
          )::time INTO utc_time;
          
          -- Insert into user_notifications
          INSERT INTO user_notifications (
            user_id,
            type,
            title,
            body,
            scheduled_time,
            data,
            status
          ) VALUES (
            p_user_id,
            'journal_reminder',
            reminder_label,
            'Time to reflect on your day and write in your journal.',
            utc_time,
            jsonb_build_object(
              'reminder_key', reminder_key,
              'original_time', reminder_time,
              'user_timezone', user_profile.timezone,
              'converted_utc_time', utc_time::text
            ),
            'active'
          );
          
          inserted_count := inserted_count + 1;
          
        EXCEPTION WHEN OTHERS THEN
          -- Log conversion error but continue
          RAISE WARNING 'Failed to convert time % for user % in timezone %: %', 
            reminder_time, p_user_id, user_profile.timezone, SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;
  
  result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'timezone', user_profile.timezone,
    'notifications_created', inserted_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- Function to sync all users' reminder settings (for migration)
CREATE OR REPLACE FUNCTION sync_all_reminder_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record RECORD;
  sync_result jsonb;
  total_users INTEGER := 0;
  successful_syncs INTEGER := 0;
  failed_syncs INTEGER := 0;
  results jsonb := '[]'::jsonb;
BEGIN
  -- Process all users with reminder settings
  FOR user_record IN 
    SELECT id, timezone, reminder_settings 
    FROM profiles 
    WHERE reminder_settings IS NOT NULL 
    AND reminder_settings != '{}'::jsonb
  LOOP
    total_users := total_users + 1;
    
    BEGIN
      -- Sync this user's settings
      sync_result := sync_reminder_settings_to_notifications(user_record.id);
      
      IF sync_result->>'success' = 'true' THEN
        successful_syncs := successful_syncs + 1;
      ELSE
        failed_syncs := failed_syncs + 1;
      END IF;
      
      -- Add to results
      results := results || jsonb_build_array(
        jsonb_build_object(
          'user_id', user_record.id,
          'result', sync_result
        )
      );
      
    EXCEPTION WHEN OTHERS THEN
      failed_syncs := failed_syncs + 1;
      results := results || jsonb_build_array(
        jsonb_build_object(
          'user_id', user_record.id,
          'error', SQLERRM
        )
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_users_processed', total_users,
    'successful_syncs', successful_syncs,
    'failed_syncs', failed_syncs,
    'timestamp', NOW(),
    'details', results
  );
END;
$$;