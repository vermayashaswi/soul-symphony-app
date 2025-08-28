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

    const { userId, bypassUserPreferences = false, testAllFunctions = false } = await req.json();
    
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

    // 3. COMPREHENSIVE NOTIFICATION TESTING - Test ALL notification functions
    console.log('[TestFlow] Starting comprehensive notification testing...');
    
    const testResults = {
      fcmPush: { sent: false, error: null, response: null },
      inApp: { sent: false, error: null },
      custom: { sent: false, error: null, response: null },
      categorized: { sent: false, error: null, response: null }
    };

    // 3.1. Test direct FCM push notification
    console.log('[TestFlow] Testing FCM push notification...');
    try {
      const fcmResponse = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          userIds: [userId],
          title: '🧪 FCM Push Test',
          body: 'Direct FCM push notification test - should appear in status bar!',
          data: {
            type: 'test_fcm_push',
            test_id: 'fcm-direct-test',
            bypass: String(bypassUserPreferences),
            timestamp: String(Date.now())
          },
          actionUrl: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
        }
      });
      testResults.fcmPush.sent = !fcmResponse.error;
      testResults.fcmPush.error = fcmResponse.error?.message;
      testResults.fcmPush.response = fcmResponse.data;
      console.log('[TestFlow] FCM Response:', fcmResponse);
    } catch (error) {
      testResults.fcmPush.error = error.message;
      console.error('[TestFlow] FCM Error:', error);
    }

    // 3.2. Test custom notification function
    if (testAllFunctions) {
      console.log('[TestFlow] Testing send-custom-notification...');
      try {
        const customResponse = await supabase.functions.invoke('send-custom-notification', {
          body: {
            userId: userId,
            title: '🎯 Custom Notification Test',
            message: 'Custom notification function test - bypass all logic!',
            type: 'test_custom',
            data: {
              test_id: 'custom-test',
              bypass: bypassUserPreferences
            },
            actionUrl: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
          }
        });
        testResults.custom.sent = !customResponse.error;
        testResults.custom.error = customResponse.error?.message;
        testResults.custom.response = customResponse.data;
        console.log('[TestFlow] Custom Response:', customResponse);
      } catch (error) {
        testResults.custom.error = error.message;
        console.error('[TestFlow] Custom Error:', error);
      }

      // 3.3. Test categorized notification function  
      console.log('[TestFlow] Testing send-categorized-notification...');
      try {
        const categorizedResponse = await supabase.functions.invoke('send-categorized-notification', {
          body: {
            userIds: [userId],
            title: '📋 Categorized Test',
            message: 'Categorized notification test - bypass preferences!',
            category: 'journal_reminder',
            data: {
              test_id: 'categorized-test',
              bypass: bypassUserPreferences
            },
            actionUrl: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
          }
        });
        testResults.categorized.sent = !categorizedResponse.error;
        testResults.categorized.error = categorizedResponse.error?.message;
        testResults.categorized.response = categorizedResponse.data;
        console.log('[TestFlow] Categorized Response:', categorizedResponse);
      } catch (error) {
        testResults.categorized.error = error.message;
        console.error('[TestFlow] Categorized Error:', error);
      }
    }

    // 3.4. Create direct in-app notification for comparison
    console.log('[TestFlow] Creating direct in-app notification...');
    try {
      const { error: appNotificationError } = await supabase
        .from('user_app_notifications')
        .insert({
          user_id: userId,
          title: '📱 Direct In-App Test',
          message: 'Direct in-app notification test - should appear in notification center!',
          type: 'test_in_app_direct',
          data: {
            test_id: 'in-app-direct-test',
            bypass: bypassUserPreferences
          },
          action_url: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
        });

      testResults.inApp.sent = !appNotificationError;
      testResults.inApp.error = appNotificationError?.message;
      
      if (appNotificationError) {
        console.error('[TestFlow] In-app notification error:', appNotificationError);
      } else {
        console.log('[TestFlow] In-app notification created successfully');
      }
    } catch (error) {
      testResults.inApp.error = error.message;
      console.error('[TestFlow] In-app creation error:', error);
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
      testNotifications: testResults,
      testConfig: {
        bypassUserPreferences,
        testAllFunctions,
        functionsTestedCount: testAllFunctions ? 4 : 2
      },
      summary: {
        totalTests: testAllFunctions ? 4 : 2,
        successful: Object.values(testResults).filter(r => r.sent).length,
        failed: Object.values(testResults).filter(r => !r.sent).length
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