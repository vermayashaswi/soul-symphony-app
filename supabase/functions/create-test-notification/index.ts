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

    console.log('[CreateTestNotification] Creating test notification for user:', userId);

    // Create test notifications in user_app_notifications table (the correct table)
    const testNotifications = [
      {
        user_id: userId,
        title: '🧪 Test Journal Reminder',
        message: 'This is a test notification to verify your notification system is working!',
        type: 'reminder',
        data: {
          type: 'test_notification',
          test_id: 'manual-test-1',
        },
        action_url: '/app/journal',
        action_label: 'Open Journal'
      },
      {
        user_id: userId,
        title: '📝 Welcome to Your Journal',
        message: 'Welcome! Your personal journaling space is ready. Start capturing your thoughts and reflections.',
        type: 'info',
        data: {
          type: 'welcome_notification',
          test_id: 'manual-test-2',
        },
        action_url: '/app/journal',
        action_label: 'Start Writing'
      },
      {
        user_id: userId,
        title: '⚠️ Test Warning Notification',
        message: 'This is a test warning notification to ensure all notification types are working properly.',
        type: 'warning',
        data: {
          type: 'test_warning',
          test_id: 'manual-test-3',
        }
      }
    ];

    // Insert notifications into user_app_notifications table
    const { data: insertedNotifications, error: insertError } = await supabase
      .from('user_app_notifications')
      .insert(testNotifications)
      .select();

    if (insertError) {
      console.error('[CreateTestNotification] Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log('[CreateTestNotification] Successfully created', insertedNotifications?.length || 0, 'test notifications');

    // Also check existing notifications count
    const { count: existingCount } = await supabase
      .from('user_app_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('dismissed_at', null);

    return new Response(JSON.stringify({
      success: true,
      userId,
      notifications_created: insertedNotifications?.length || 0,
      total_notifications: existingCount || 0,
      created_notifications: insertedNotifications,
      message: `Successfully created ${insertedNotifications?.length || 0} test notifications`
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('[CreateTestNotification] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});