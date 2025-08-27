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

    // Prepare FCM message
    const tokens = devices.map(device => device.device_token);
    const fcmMessage = {
      registration_ids: tokens,
      notification: {
        title,
        body,
        icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
        badge: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png',
        click_action: actionUrl || 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com',
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
    };

    // Get Firebase server key (you'll need to add this as a secret)
    const serverKey = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!serverKey) {
      throw new Error('Firebase server key not configured');
    }

    // Send FCM notification
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmMessage),
    });

    const fcmResult = await fcmResponse.json();
    console.log('[FCM] Response:', fcmResult);

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

    return new Response(JSON.stringify({
      success: true,
      fcmResult,
      devicesNotified: devices.length,
      inAppNotificationsCreated: userIds.length,
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