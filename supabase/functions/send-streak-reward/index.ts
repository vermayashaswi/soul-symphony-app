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
    console.log('[Streak Reward] Starting streak reward check...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users to check their streaks
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, timezone');

    if (usersError) {
      console.error('[Streak Reward] Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`[Streak Reward] Checking streaks for ${users?.length || 0} users`);

    // Predefined streak reward messages
    const streakMessages = [
      "🔥 You've journaled 7 days in a row! Keep the flow going.",
      "✨ Amazing! 7-day streak achieved. Your consistency is inspiring!",
      "🌟 Seven days strong! Your dedication to reflection shines.",
      "🎯 Week-long streak complete! You're building something beautiful.",
      "🌿 7 days of growth captured! Your future self will thank you.",
      "📚 One week of wisdom documented. What's next?",
      "🌸 Seven days, countless insights. Keep this momentum!",
      "🏆 7-day journalist! Your commitment is paying off.",
      "💫 A full week of self-reflection - you're unstoppable!",
      "🌺 Seven days of soul exploration. Ready for more?"
    ];

    let sentCount = 0;
    let failedCount = 0;

    for (const user of users || []) {
      try {
        // Calculate user's current streak using the database function
        const { data: streakData, error: streakError } = await supabase
          .rpc('calculate_user_streak', { user_id_param: user.id });

        if (streakError) {
          console.error(`[Streak Reward] Error calculating streak for user ${user.id}:`, streakError);
          failedCount++;
          continue;
        }

        const currentStreak = streakData || 0;
        console.log(`[Streak Reward] User ${user.id} has streak of ${currentStreak} days`);

        // Only send notification for exactly 7-day streaks (and multiples of 7)
        if (currentStreak > 0 && currentStreak % 7 === 0) {
          // Check if we already sent a streak notification for this exact streak
          const { data: existingNotification } = await supabase
            .from('user_app_notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'streak_reward')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
            .single();

          if (existingNotification) {
            console.log(`[Streak Reward] Already sent streak notification to user ${user.id} today`);
            continue;
          }

          // Select random message
          const randomMessage = streakMessages[Math.floor(Math.random() * streakMessages.length)];
          const customMessage = randomMessage.replace('7 days', `${currentStreak} days`).replace('Seven days', `${currentStreak} days`);
          
          const userName = user.display_name || user.full_name || 'there';

          // Invoke send-custom-notification function
          const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
            body: {
              userIds: [user.id],
              title: `${currentStreak}-Day Streak!`,
              body: customMessage,
              type: 'streak_reward',
              category: 'Reward',
              sendInApp: false, // Only push notifications for status bar
              sendPush: true,
              actionUrl: '/app/insights',
              actionLabel: 'View Progress',
              data: {
                streak_days: currentStreak,
                action: 'open_journal'
              }
            }
          });

          if (notificationError) {
            console.error(`[Streak Reward] Failed to send notification to user ${user.id}:`, notificationError);
            failedCount++;
          } else {
            console.log(`[Streak Reward] Sent ${currentStreak}-day streak reward to user ${user.id}`);
            sentCount++;
          }
        }
      } catch (error) {
        console.error(`[Streak Reward] Error processing user ${user.id}:`, error);
        failedCount++;
      }
    }

    console.log(`[Streak Reward] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Streak reward notifications processed',
      sent: sentCount,
      failed: failedCount,
      total_users_checked: users?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Streak Reward] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});