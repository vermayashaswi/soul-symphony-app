-- Fix data inconsistencies for notification preferences
-- This migration addresses users who have master_notifications: true but subcategories as false

DO $$
DECLARE
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Find users with inconsistent notification preferences
    FOR user_record IN 
        SELECT id, notification_preferences 
        FROM profiles 
        WHERE notification_preferences IS NOT NULL
        AND notification_preferences::jsonb->>'master_notifications' = 'true'
        AND (
            notification_preferences::jsonb->>'in_app_notifications' = 'false'
            OR notification_preferences::jsonb->>'insightful_reminders' = 'false'
            OR notification_preferences::jsonb->>'journaling_reminders' = 'false'
        )
    LOOP
        -- Update preferences to enable all subcategories when master is enabled
        UPDATE profiles 
        SET notification_preferences = jsonb_build_object(
            'master_notifications', true,
            'in_app_notifications', true,
            'insightful_reminders', true,
            'journaling_reminders', true
        ),
        updated_at = NOW()
        WHERE id = user_record.id;
        
        updated_count := updated_count + 1;
        
        RAISE NOTICE 'Fixed notification preferences for user: %', user_record.id;
    END LOOP;
    
    RAISE NOTICE 'Fixed notification preferences for % users', updated_count;
END $$;