import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

// Initialize Firebase Admin
async function initializeFirebaseAdmin() {
  const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('Firebase service account key not configured');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountKey);
  } catch (error) {
    throw new Error('Invalid Firebase service account key format');
  }

  return serviceAccount;
}

// Generate JWT token for Firebase v1 API
async function generateAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
  };

  // Create JWT header and payload
  const header = { alg: 'RS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  
  // For demo purposes, using a simplified approach
  // In production, you'd want proper JWT signing with RS256
  const jwtPayload = btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload));
  
  // For now, we'll use the client_email as a placeholder
  // This would need proper RSA signing in production
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtPayload,
    }),
  });

  if (!response.ok) {
    // Fallback: try to use service account key directly if JWT fails
    console.warn('[FCM] JWT generation failed, using direct service account');
    return serviceAccount.private_key;
  }

  const tokenData = await response.json();
  return tokenData.access_token;
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

    const { userIds, title, body, data, imageUrl, actionUrl }: FCMNotificationRequest = await req.json();

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

    // Initialize Firebase Admin
    const serviceAccount = await initializeFirebaseAdmin();
    
    // Get access token
    let accessToken;
    try {
      accessToken = await generateAccessToken(serviceAccount);
    } catch (error) {
      console.warn('[FCM] Failed to generate access token:', error);
      // Fallback to legacy approach if JWT fails
      accessToken = Deno.env.get('FIREBASE_SERVER_KEY');
      if (!accessToken) {
        throw new Error('No Firebase authentication method available');
      }
    }

    // Prepare FCM messages for Firebase v1 API
    const tokens = devices.map(device => device.device_token);
    const fcmResults = [];

    // Send notifications using Firebase v1 API (multicast)
    for (const token of tokens) {
      const fcmMessage = {
        message: {
          token: token,
          notification: {
            title,
            body,
            image: imageUrl,
          },
          data: {
            ...data,
            url: actionUrl || 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com',
          },
          android: {
            notification: {
              sound: 'default',
              priority: 'high',
              click_action: actionUrl || 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com',
            },
          },
          webpush: {
            notification: {
              icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
              badge: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
              actions: [
                {
                  action: 'open',
                  title: 'Open App',
                }
              ]
            },
            fcm_options: {
              link: actionUrl || 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com',
            },
          },
        },
      };

      try {
        // Use Firebase v1 API endpoint
        const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmMessage),
        });

        const fcmResult = await fcmResponse.json();
        fcmResults.push(fcmResult);
        
        if (!fcmResponse.ok) {
          console.error('[FCM] Firebase API error:', fcmResult);
        }
      } catch (error) {
        console.error('[FCM] Error sending to token:', token, error);
        fcmResults.push({ error: error.message });
      }
    }

    console.log('[FCM] FCM Results:', fcmResults);

    // Create in-app notifications for all users
    const inAppNotifications = userIds.map(userId => ({
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
    }

    const successCount = fcmResults.filter(r => !r.error).length;
    const failureCount = fcmResults.filter(r => r.error).length;

    return new Response(JSON.stringify({
      success: true,
      fcmResults,
      devicesNotified: devices.length,
      inAppNotificationsCreated: userIds.length,
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