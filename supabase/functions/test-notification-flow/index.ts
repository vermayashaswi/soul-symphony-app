import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[TestFlow] Testing notification flow for user:', userId);

    // 1. Check if user exists and has device tokens
    const { data: devices, error: devicesError } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId);

    if (devicesError) {
      throw devicesError;
    }

    console.log('[TestFlow] User devices found:', devices?.length || 0);

    // 2. Check if user has active reminder settings
    const { data: reminders, error: remindersError } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'journal_reminder')
      .eq('status', 'active');

    if (remindersError) {
      throw remindersError;
    }

    console.log('[TestFlow] Active reminders found:', reminders?.length || 0);

    // 3. Send both FCM push notification and in-app notification
    console.log('[TestFlow] Sending FCM push notification...');
    
    const fcmResponse = await supabase.functions.invoke('send-fcm-notification', {
      body: {
        userIds: [userId],
        title: '🧪 Test Push Notification',
        body: 'This is a test PUSH notification to verify status bar notifications work!',
        data: {
          type: 'test_push_notification',
          test_id: 'manual-push-test',
        },
        actionUrl: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
      }
    });

    console.log('[TestFlow] FCM Response:', fcmResponse);

    // 4. Also create an in-app notification for comparison
    console.log('[TestFlow] Creating in-app notification...');
    
    const { error: appNotificationError } = await supabase
      .from('user_app_notifications')
      .insert({
        user_id: userId,
        title: '📱 Test In-App Notification',
        message: 'This is a test IN-APP notification to verify notification center works!',
        type: 'test_in_app_notification',
        data: {
          test_id: 'manual-in-app-test',
        },
        action_url: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
      });

    if (appNotificationError) {
      console.error('[TestFlow] Error creating in-app notification:', appNotificationError);
    } else {
      console.log('[TestFlow] In-app notification created successfully');
    }

    // 5. Get profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return new Response(JSON.stringify({
      success: true,
      userId,
      profile: {
        name: profile?.display_name || profile?.full_name || 'Unknown',
        hasProfile: !!profile
      },
      devices: {
        count: devices?.length || 0,
        platforms: devices?.map(d => d.platform) || [],
        tokens: devices?.map(d => ({ platform: d.platform, token: d.device_token?.substring(0, 20) + '...' })) || []
      },
      reminders: {
        count: reminders?.length || 0,
        settings: reminders?.map(r => ({ time: r.scheduled_time, title: r.title, status: r.status })) || []
      },
      testNotifications: {
        fcmPush: {
          sent: !fcmResponse.error,
          error: fcmResponse.error?.message,
          response: fcmResponse.data
        },
        inApp: {
          sent: !appNotificationError,
          error: appNotificationError?.message
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('[TestFlow] Error in test flow:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});