import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface InactivityNudgeRequest {
  days: number; // 3, 7, 15, or 30
}

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
    console.log('[Inactivity Nudge] Starting inactivity nudge check...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body if provided
    let targetDays = 3; // Default to 3 days
    try {
      const body = await req.json();
      if (body.days) {
        targetDays = body.days;
      }
    } catch (e) {
      console.log('[Inactivity Nudge] No body provided, using default 3 days');
    }

    console.log(`[Inactivity Nudge] Checking for users inactive for ${targetDays} days`);

    // Get users who haven't journaled in the specified number of days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - targetDays);

    const { data: inactiveUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, timezone')
      .not('id', 'in', `(
        SELECT DISTINCT user_id 
        FROM "Journal Entries" 
        WHERE created_at >= '${cutoffDate.toISOString()}'
      )`);

    if (usersError) {
      console.error('[Inactivity Nudge] Error fetching inactive users:', usersError);
      throw usersError;
    }

    console.log(`[Inactivity Nudge] Found ${inactiveUsers?.length || 0} inactive users for ${targetDays} days`);

    // Predefined messages for each timeframe
    const messages = {
      3: [
        "🌱 Haven't written in 3 days? A small reflection might help.",
        "✨ Just 3 days away from journaling - what's been on your mind?",
        "🌿 Your thoughts are waiting to be explored. Ready to journal?",
        "💭 Three days of stories untold - time to capture them!",
        "🌸 A gentle reminder: your journal misses your voice.",
        "🎯 3-day pause complete? Let's pick up where you left off.",
        "🌺 Quick check-in: How are you feeling today?",
        "📖 Your digital diary is ready for today's chapter.",
        "🌟 Small moments, big insights - ready to journal?",
        "🍃 Been thinking about anything worth writing down?"
      ],
      7: [
        "🌱 It's been a week - what stories are you carrying?",
        "📚 7 days of experiences waiting to be captured.",
        "🌿 A week away from your thoughts - ready to reconnect?",
        "✨ Seven days, countless moments - let's journal them.",
        "🌸 Your weekly reflection is calling - answer it?",
        "🎯 One week break complete - time to dive back in.",
        "🌺 How has this week shaped you? Let's explore.",
        "📖 A week's worth of growth waiting to be written.",
        "🌟 Seven days of life - ready to make sense of it all?",
        "🍃 Week-long pause over - your journal awaits."
      ],
      15: [
        "🌱 Two weeks away - what's been brewing in your mind?",
        "📚 15 days of experiences ready to be explored.",
        "🌿 Half a month of thoughts - let's capture them.",
        "✨ Two weeks wiser - time to journal your growth.",
        "🌸 15-day journey complete - ready to reflect?",
        "🎯 Two weeks of life experiences - worth documenting.",
        "🌺 Half a month pause - your insights are waiting.",
        "📖 15 days of stories - let's bring them to light.",
        "🌟 Two weeks of growth - time to journal it out.",
        "🍃 Mid-month check-in - how are you really doing?"
      ],
      30: [
        "🌱 A month away - what transformations have you noticed?",
        "📚 30 days of life - ready to make sense of it all?",
        "🌿 One month of experiences waiting to be explored.",
        "✨ Monthly reflection time - what's changed in you?",
        "🌸 30-day journey complete - let's journal your growth.",
        "🎯 A full month of insights - worth capturing.",
        "🌺 Monthly pause over - your thoughts are calling.",
        "📖 One month of stories - time to write them down.",
        "🌟 30 days wiser - ready to reflect on your journey?",
        "🍃 Monthly check-in - how has this month shaped you?"
      ]
    };

    let sentCount = 0;
    let failedCount = 0;

    for (const user of inactiveUsers || []) {
      try {
        // Select random message for the timeframe
        const timeframeMessages = messages[targetDays as keyof typeof messages] || messages[3];
        const randomMessage = timeframeMessages[Math.floor(Math.random() * timeframeMessages.length)];
        
        const userName = user.display_name || user.full_name || 'there';

        // Invoke send-custom-notification function
        const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
          body: {
            userIds: [user.id],
            title: 'Time to reflect',
            body: randomMessage,
            type: 'inactivity_nudge',
            category: 'Activation',
            sendInApp: false, // Only push notifications for status bar
            sendPush: true,
            data: {
              days: targetDays,
              action: 'open_journal'
            }
          }
        });

        if (notificationError) {
          console.error(`[Inactivity Nudge] Failed to send notification to user ${user.id}:`, notificationError);
          failedCount++;
        } else {
          console.log(`[Inactivity Nudge] Sent ${targetDays}-day nudge to user ${user.id}`);
          sentCount++;
        }
      } catch (error) {
        console.error(`[Inactivity Nudge] Error processing user ${user.id}:`, error);
        failedCount++;
      }
    }

    console.log(`[Inactivity Nudge] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Inactivity nudge notifications processed for ${targetDays} days`,
      sent: sentCount,
      failed: failedCount,
      total_inactive_users: inactiveUsers?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Inactivity Nudge] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});