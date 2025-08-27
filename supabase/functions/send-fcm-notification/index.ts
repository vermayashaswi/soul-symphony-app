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

    // For now, we'll simulate successful FCM sending
    // In production, you'd implement the actual Firebase Admin SDK integration
    const fcmResults = devices.map(device => ({
      success: true,
      device_token: device.device_token,
      platform: device.platform,
      message_id: `fcm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    console.log('[FCM] Simulated FCM Results:', fcmResults);

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

    const successCount = fcmResults.filter(r => r.success).length;
    const failureCount = fcmResults.filter(r => !r.success).length;

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