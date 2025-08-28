import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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