import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Shared notification type mappings
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
  'writing_reminder': 'journaling_reminders',
  
  // Feature Updates (special category - always shown regardless of preferences)
  'feature_update': 'system',
  'smart_chat_invite': 'system',
  'custom': 'system'
};

function getNotificationCategory(notificationType: string): string | null {
  return NOTIFICATION_TYPE_MAPPING[notificationType] || null;
}

function shouldBypassPreferences(notificationType: string): boolean {
  const category = getNotificationCategory(notificationType);
  return category === 'system';
}

interface NotificationPreferences {
  master_notifications: boolean;
  in_app_notifications: boolean;
  insightful_reminders: boolean;
  journaling_reminders: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CustomNotificationRequest {
  userIds: string[]
  title: string
  body: string
  type: 'smart_chat_invite' | 'insights_ready' | 'feature_update' | 'journal_reminder' | 'custom'
  actionUrl?: string
  actionLabel?: string
  data?: Record<string, any>
  sendPush?: boolean // Whether to send as status bar notification
  sendInApp?: boolean // Whether to send as in-app notification
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CustomNotification] Processing custom notification request');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request
    const notificationRequest: CustomNotificationRequest = await req.json()
    console.log('[CustomNotification] Request:', {
      userIds: notificationRequest.userIds,
      type: notificationRequest.type,
      title: notificationRequest.title,
      sendPush: notificationRequest.sendPush,
      sendInApp: notificationRequest.sendInApp
    });

    const results = {
      inAppNotifications: { success: 0, failed: 0 },
      pushNotifications: { success: 0, failed: 0 },
      errors: [] as string[]
    }

    // Create in-app notifications if requested
    if (notificationRequest.sendInApp !== false) {
      console.log('[CustomNotification] Creating in-app notifications');
      
      for (const userId of notificationRequest.userIds) {
        try {
          // Check if we should bypass user preferences for system notifications
          const shouldBypass = shouldBypassPreferences(notificationRequest.type);
          let shouldSendInApp = true;

          if (!shouldBypass) {
            // Check user's notification preferences
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('notification_preferences')
              .eq('id', userId)
              .single();

            if (profileError) {
              console.warn(`[CustomNotification] Could not fetch preferences for user ${userId}:`, profileError);
              // Continue with default behavior (send notification)
            } else {
              const preferences: NotificationPreferences = profileData?.notification_preferences || {
                master_notifications: false,
                in_app_notifications: true,
                insightful_reminders: true,
                journaling_reminders: true
              };

              // Check master notifications first
              if (!preferences.master_notifications) {
                console.log(`[CustomNotification] Master notifications disabled for user ${userId}`);
                shouldSendInApp = false;
              } else {
                // Check specific category
                const category = getNotificationCategory(notificationRequest.type);
                if (category && !preferences[category as keyof NotificationPreferences]) {
                  console.log(`[CustomNotification] Category '${category}' disabled for user ${userId}`);
                  shouldSendInApp = false;
                }
              }
            }
          }

          if (shouldSendInApp) {
            const { error: inAppError } = await supabase
              .from('user_app_notifications')
              .insert({
                user_id: userId,
                title: notificationRequest.title,
                message: notificationRequest.body,
                type: getInAppNotificationType(notificationRequest.type),
                action_url: notificationRequest.actionUrl,
                action_label: notificationRequest.actionLabel,
                data: notificationRequest.data || {}
              })

            if (inAppError) {
              console.error('[CustomNotification] In-app notification error:', inAppError);
              results.inAppNotifications.failed++
              results.errors.push(`In-app notification failed for user ${userId}: ${inAppError.message}`)
            } else {
              results.inAppNotifications.success++
            }
          } else {
            console.log(`[CustomNotification] Skipping in-app notification for user ${userId} due to preferences`);
          }
        } catch (error) {
          console.error('[CustomNotification] In-app notification error:', error);
          results.inAppNotifications.failed++
          results.errors.push(`In-app notification failed for user ${userId}: ${error.message}`)
        }
      }
    }

    // Send push notifications if requested
    if (notificationRequest.sendPush !== false) {
      console.log('[CustomNotification] Sending push notifications via FCM edge function');
      
      try {
        const fcmResponse = await supabase.functions.invoke('send-fcm-notification', {
          body: {
            userIds: notificationRequest.userIds,
            title: notificationRequest.title,
            body: notificationRequest.body,
            actionUrl: notificationRequest.actionUrl,
            actionLabel: notificationRequest.actionLabel,
            data: {
              type: notificationRequest.type,
              ...notificationRequest.data
            }
          }
        })

        if (fcmResponse.error) {
          console.error('[CustomNotification] FCM function error:', fcmResponse.error);
          results.errors.push(`FCM notification failed: ${fcmResponse.error.message}`)
        } else {
          const fcmData = fcmResponse.data
          results.pushNotifications.success = fcmData.successfulNotifications || 0
          results.pushNotifications.failed = fcmData.failedNotifications || 0
        }
      } catch (error) {
        console.error('[CustomNotification] FCM function error:', error);
        results.errors.push(`FCM notification failed: ${error.message}`)
      }
    }

    console.log('[CustomNotification] Results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Custom notifications processed',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[CustomNotification] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

function getInAppNotificationType(customType: string): 'info' | 'success' | 'warning' | 'error' | 'reminder' {
  switch (customType) {
    case 'smart_chat_invite':
      return 'info'
    case 'insights_ready':
      return 'success'
    case 'feature_update':
      return 'info'
    case 'journal_reminder':
      return 'reminder'
    default:
      return 'info'
  }
}