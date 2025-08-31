import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  userId: string;
  notificationType: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  targetUrl?: string;
  icon?: string;
}

interface NotificationPreferences {
  master_notifications: boolean;
  in_app_notifications: boolean;
  insightful_reminders: boolean;
  journaling_reminders: boolean;
}

// Map notification types to categories
const NOTIFICATION_TYPE_MAPPING: Record<string, string> = {
  // In-App Notifications
  'success': 'in_app_notifications',
  'info': 'in_app_notifications',
  'warning': 'in_app_notifications',
  'error': 'in_app_notifications',
  'achievement': 'in_app_notifications',
  
  // Insightful Reminders
  'goal_achievement': 'insightful_reminders',
  'streak_reward': 'insightful_reminders',
  'sleep_reflection': 'insightful_reminders',
  'journal_insights': 'insightful_reminders',
  'mood_tracking_prompt': 'insightful_reminders',
  'inactivity_nudge': 'insightful_reminders',
  'insights_ready': 'insightful_reminders',
  
  // Journaling Reminders
  'journal_reminder': 'journaling_reminders',
  'daily_prompt': 'journaling_reminders',
  'writing_reminder': 'journaling_reminders'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, notificationType, title, body, data, targetUrl, icon }: NotificationRequest = await req.json();

    console.log(`[send-categorized-notification] Processing notification for user ${userId}, type: ${notificationType}`);

    // Get user's notification preferences
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[send-categorized-notification] Error fetching user preferences:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch user preferences' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preferences: NotificationPreferences = profileData?.notification_preferences || {
      master_notifications: false,
      in_app_notifications: true,
      insightful_reminders: true,
      journaling_reminders: true
    };

    // Check if master notifications are disabled
    if (!preferences.master_notifications) {
      console.log('[send-categorized-notification] Master notifications disabled for user');
      return new Response(
        JSON.stringify({ success: false, error: 'Master notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if specific category is enabled
    const category = NOTIFICATION_TYPE_MAPPING[notificationType];
    if (category && !preferences[category as keyof NotificationPreferences]) {
      console.log(`[send-categorized-notification] Category '${category}' disabled for user`);
      return new Response(
        JSON.stringify({ success: false, error: `Category '${category}' disabled` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send notification based on category
    if (category === 'in_app_notifications') {
      // Create in-app notification
      const { error: notificationError } = await supabase
        .from('user_app_notifications')
        .insert({
          user_id: userId,
          title,
          message: body,
          type: notificationType,
          action_url: targetUrl,
          data: data || {}
        });

      if (notificationError) {
        console.error('[send-categorized-notification] Error creating in-app notification:', notificationError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create in-app notification' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[send-categorized-notification] In-app notification created successfully');
    } else {
      // Send push notification for other categories
      // Get user's device tokens
      const { data: devices, error: devicesError } = await supabase
        .from('user_devices')
        .select('device_token, platform')
        .eq('user_id', userId);

      if (devicesError || !devices || devices.length === 0) {
        console.log('[send-categorized-notification] No devices found for user');
        return new Response(
          JSON.stringify({ success: false, error: 'No devices registered for user' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send FCM notification to each device
      for (const device of devices) {
        try {
          const response = await supabase.functions.invoke('send-fcm-notification', {
            body: {
              token: device.device_token,
              title,
              body,
              data: data || {},
              targetUrl,
              icon
            }
          });

          if (response.error) {
            console.error(`[send-categorized-notification] FCM error for device ${device.device_token}:`, response.error);
          } else {
            console.log(`[send-categorized-notification] FCM notification sent to ${device.platform} device`);
          }
        } catch (fcmError) {
          console.error(`[send-categorized-notification] FCM sending failed for device:`, fcmError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-categorized-notification] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});