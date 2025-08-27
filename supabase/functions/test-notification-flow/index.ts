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

    // 3. Send a test notification regardless of settings
    console.log('[TestFlow] Sending test notification...');
    
    const fcmResponse = await supabase.functions.invoke('send-fcm-notification', {
      body: {
        userIds: [userId],
        title: '🧪 Test Journal Reminder',
        body: 'This is a test notification to verify your notification system is working!',
        data: {
          type: 'test_notification',
          test_id: 'manual-test',
        },
        actionUrl: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
      }
    });

    // 4. Get profile info
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
      testNotification: {
        sent: !fcmResponse.error,
        error: fcmResponse.error?.message,
        response: fcmResponse.data
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