-- Fix the timezone conversion in sync_reminder_settings_to_notifications function
CREATE OR REPLACE FUNCTION public.sync_reminder_settings_to_notifications(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  reminder_key TEXT;
  reminder_data jsonb;
  reminder_time TEXT;
  reminder_enabled BOOLEAN;
  reminder_label TEXT;
  utc_time TIME;
  local_timestamp TIMESTAMP WITH TIME ZONE;
  utc_timestamp TIMESTAMP WITH TIME ZONE;
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
        -- Convert local time to UTC properly
        BEGIN
          -- Create a timestamp for today at the reminder time in user's timezone
          local_timestamp := (CURRENT_DATE || ' ' || reminder_time)::timestamp AT TIME ZONE user_profile.timezone;
          
          -- Convert to UTC
          utc_timestamp := local_timestamp AT TIME ZONE 'UTC';
          
          -- Extract just the time component
          utc_time := utc_timestamp::time;
          
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
              'converted_utc_time', utc_time::text,
              'local_timestamp', local_timestamp::text,
              'utc_timestamp', utc_timestamp::text
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
$function$;