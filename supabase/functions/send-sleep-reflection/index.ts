import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Sleep Reflection] Starting sleep reflection prompt check...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users for bedtime notifications
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, timezone');

    if (usersError) {
      console.error('[Sleep Reflection] Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`[Sleep Reflection] Checking bedtime reflections for ${users?.length || 0} users`);

    // Predefined sleep reflection messages
    const sleepMessages = [
      "🛌 A quick thought before bed helps clear the mind.",
      "🌙 End your day with a moment of reflection.",
      "✨ What made today special? Capture it before you sleep.",
      "🌟 A bedtime journal entry for peaceful dreams.",
      "💭 Clear your mind before rest - what's on your heart?",
      "🌺 Reflect on today's moments before you drift off.",
      "🍃 A gentle pause before sleep - what are you grateful for?",
      "🌸 End your day with intention and reflection.",
      "🌿 Before you rest, what wisdom did today bring?",
      "💫 A peaceful reflection to close your day."
    ];

    // Get current UTC time to determine if it's evening/bedtime
    const now = new Date();
    const currentUTCHour = now.getUTCHours();
    
    let sentCount = 0;
    let failedCount = 0;

    for (const user of users || []) {
      try {
        // Convert current UTC time to user's timezone to check if it's bedtime (20:00-23:00)
        const userTimezone = user.timezone || 'UTC';
        let userLocalHour = currentUTCHour;
        
        // Simple timezone conversion (this is simplified - in production you'd use a proper timezone library)
        if (userTimezone.includes('GMT+')) {
          const offset = parseInt(userTimezone.match(/GMT\+(\d+)/)?.[1] || '0');
          userLocalHour = (currentUTCHour + offset) % 24;
        } else if (userTimezone.includes('GMT-')) {
          const offset = parseInt(userTimezone.match(/GMT-(\d+)/)?.[1] || '0');
          userLocalHour = (currentUTCHour - offset + 24) % 24;
        }

        // Only send bedtime notifications between 8 PM and 11 PM local time
        if (userLocalHour < 20 || userLocalHour > 23) {
          continue;
        }

        // Check if user already got a sleep reflection today
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        
        const { data: todayNotification } = await supabase
          .from('user_app_notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'sleep_reflection')
          .gte('created_at', todayStart.toISOString())
          .single();

        if (todayNotification) {
          console.log(`[Sleep Reflection] User ${user.id} already got sleep reflection today`);
          continue;
        }

        // Select random message
        const randomMessage = sleepMessages[Math.floor(Math.random() * sleepMessages.length)];
        const userName = user.display_name || user.full_name || 'there';

        // Invoke send-custom-notification function
        const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
          body: {
            userIds: [user.id],
            title: 'Bedtime Reflection',
            body: randomMessage,
            type: 'sleep_reflection',
            category: 'Activation',
            sendInApp: false, // Only push notifications for status bar
            sendPush: true,
            actionUrl: '/app/journal?tab=record',
            actionLabel: 'Reflect Now',
            data: {
              local_hour: userLocalHour,
              timezone: userTimezone,
              action: 'open_journal'
            }
          }
        });

        if (notificationError) {
          console.error(`[Sleep Reflection] Failed to send notification to user ${user.id}:`, notificationError);
          failedCount++;
        } else {
          console.log(`[Sleep Reflection] Sent bedtime reflection to user ${user.id} (local hour: ${userLocalHour})`);
          sentCount++;
        }
      } catch (error) {
        console.error(`[Sleep Reflection] Error processing user ${user.id}:`, error);
        failedCount++;
      }
    }

    console.log(`[Sleep Reflection] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Sleep reflection notifications processed',
      sent: sentCount,
      failed: failedCount,
      total_users_checked: users?.length || 0,
      current_utc_hour: currentUTCHour
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Sleep Reflection] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});