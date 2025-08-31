import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared notification type mappings and constants
const NOTIFICATION_TYPE_MAPPING: Record<string, string> = {
  // Journaling Reminders
  'journal_reminder': 'journaling_reminders',
  'daily_prompt': 'journaling_reminders',
  'writing_reminder': 'journaling_reminders',
  
  // System notifications (bypass preferences - always shown)
  'feature_update': 'system',
  'smart_chat_invite': 'system',
  'custom': 'system',
  'success': 'system',
  'info': 'system', 
  'warning': 'system',
  'error': 'system',
  'achievement': 'system',
  'goal_achievement': 'system',
  'streak_reward': 'system',
  'sleep_reflection': 'system',
  'journal_insights': 'system',
  'mood_tracking_prompt': 'system',
  'inactivity_nudge': 'system',
  'insights_ready': 'system'
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
  journaling_reminders: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FCMNotificationRequest {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  actionUrl?: string;
  type?: string; // notification type for preference checking
  sendInApp?: boolean; // control in-app notification creation
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userIds, title, body, data, imageUrl, actionUrl, type = 'info', sendInApp = true }: FCMNotificationRequest = await req.json();

    console.log('[FCM] Sending notification to users:', userIds);

    // Get device tokens for the specified users
    const { data: devices, error: devicesError } = await supabase
      .from('user_devices')
      .select('device_token, platform, user_id')
      .in('user_id', userIds);

    if (devicesError) {
      console.error('[FCM] Error fetching devices:', devicesError);
      throw devicesError;
    }

    if (!devices || devices.length === 0) {
      console.log('[FCM] No devices found for users');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No devices found for specified users' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[FCM] Found devices:', devices.length);

    // Initialize Firebase Admin SDK
    const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      throw new Error('Firebase service account key not found');
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    const projectId = serviceAccount.project_id;

    // Get Firebase access token
    const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    }));

    const jwtData = `${jwtHeader}.${jwtPayload}`;
    
    // Properly parse and import the private key
    const privateKeyPem = serviceAccount.private_key.replace(/\\n/g, '\n');
    
    // Remove PEM headers and decode base64
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKeyPem.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
    
    // Convert base64 to ArrayBuffer
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(jwtData)
    );
    
    const jwt = `${jwtData}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Send FCM notifications to all devices
    const fcmResults = [];
    for (const device of devices) {
      try {
        const fcmMessage = {
          message: {
            token: device.device_token,
            notification: {
              title,
              body
            },
            data: {
              // Convert all data values to strings for FCM compatibility
              ...(data ? Object.fromEntries(
                Object.entries(data).map(([key, value]) => [key, String(value)])
              ) : {}),
              ...(actionUrl ? { action_url: String(actionUrl) } : {})
            },
            webpush: actionUrl ? {
              fcm_options: {
                link: actionUrl
              }
            } : undefined,
            android: {
              notification: {
                channel_id: 'default'
              },
              data: {
                // Ensure action_url is available in data for native handling
                ...(actionUrl ? { action_url: String(actionUrl) } : {})
              }
            },
            apns: {
              payload: {
                aps: {
                  category: actionUrl ? 'OPEN_URL' : undefined
                }
              }
            }
          }
        };

        const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fcmMessage)
        });

        const fcmResponseData = await fcmResponse.json();
        
        if (fcmResponse.ok) {
          fcmResults.push({
            success: true,
            device_token: device.device_token,
            platform: device.platform,
            message_id: fcmResponseData.name
          });
          console.log('[FCM] Successfully sent to:', device.device_token.substring(0, 20) + '...');
        } else {
          fcmResults.push({
            success: false,
            device_token: device.device_token,
            platform: device.platform,
            error: fcmResponseData.error?.message || 'Unknown error'
          });
          console.error('[FCM] Failed to send to:', device.device_token.substring(0, 20) + '...', fcmResponseData.error);
        }
      } catch (error) {
        fcmResults.push({
          success: false,
          device_token: device.device_token,
          platform: device.platform,
          error: error.message
        });
        console.error('[FCM] Error sending to device:', error);
      }
    }

    console.log('[FCM] Real FCM Results:', fcmResults);

    // Create in-app notifications only if preferences allow and sendInApp is true
    let inAppNotificationsCreated = 0;
    if (sendInApp) {
      // Check user preferences for in-app notifications
      const usersToNotify = [];
      
      for (const userId of userIds) {
        // Check if notification should bypass preferences
        if (shouldBypassPreferences(type)) {
          usersToNotify.push(userId);
          continue;
        }
        
        // Get user's notification preferences
        const { data: profile } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', userId)
          .single();
        
        if (profile?.notification_preferences) {
          const prefs = profile.notification_preferences as NotificationPreferences;
          const category = getNotificationCategory(type);
          
          // Check if master notifications and the specific category are enabled
          const masterEnabled = prefs.master_notifications !== false; // default to true if undefined
          
          // For simplified system: only system notifications and journaling reminders
          if (category === 'system') {
            usersToNotify.push(userId); // System notifications always go through
          } else if (category === 'journaling_reminders' && masterEnabled && prefs.journaling_reminders !== false) {
            usersToNotify.push(userId);
          } else {
            console.log(`[FCM] Skipping in-app notification for user ${userId} - category ${category} disabled or master disabled`);
          }
        } else {
          // If no preferences found, default to allowing notifications
          usersToNotify.push(userId);
        }
      }
      
      if (usersToNotify.length > 0) {
        const inAppNotifications = usersToNotify.map(userId => ({
          user_id: userId,
          title,
          message: body,
          type: 'info',
          data: data || {},
          action_url: actionUrl,
          action_label: 'View',
        }));

        const { error: notificationError } = await supabase
          .from('user_app_notifications')
          .insert(inAppNotifications);

        if (notificationError) {
          console.error('[FCM] Error creating in-app notifications:', notificationError);
        } else {
          inAppNotificationsCreated = usersToNotify.length;
        }
      }
    }

    const successCount = fcmResults.filter(r => r.success).length;
    const failureCount = fcmResults.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      success: true,
      fcmResults,
      devicesNotified: devices.length,
      inAppNotificationsCreated,
      pushNotificationStats: {
        sent: successCount,
        failed: failureCount,
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('[FCM] Error sending notification:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});