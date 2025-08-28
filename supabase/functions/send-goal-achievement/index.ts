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
    console.log('[Goal Achievement] Starting goal achievement check...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request to see if checking for specific user (triggered by new entry)
    let specificUserId = null;
    try {
      const body = await req.json();
      specificUserId = body.user_id;
    } catch (e) {
      console.log('[Goal Achievement] No specific user provided, checking all users');
    }

    // Milestone thresholds
    const milestones = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

    let query = supabase
      .from('profiles')
      .select('id, display_name, full_name, entry_count, timezone');

    if (specificUserId) {
      query = query.eq('id', specificUserId);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('[Goal Achievement] Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`[Goal Achievement] Checking achievements for ${users?.length || 0} users`);

    let sentCount = 0;
    let failedCount = 0;

    for (const user of users || []) {
      try {
        const entryCount = user.entry_count || 0;
        
        // Check if current entry count hits any milestone
        const achievedMilestone = milestones.find(milestone => entryCount === milestone);
        
        if (achievedMilestone) {
          console.log(`[Goal Achievement] User ${user.id} achieved ${achievedMilestone} entries milestone`);

          // Check if we already sent this milestone notification
          const { data: existingNotification } = await supabase
            .from('user_app_notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'goal_achievement')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Within last 7 days
            .ilike('message', `%${achievedMilestone}%`)
            .single();

          if (existingNotification) {
            console.log(`[Goal Achievement] Already sent ${achievedMilestone} milestone notification to user ${user.id}`);
            continue;
          }

          // Calculate percentile (simplified estimation)
          const { data: totalUsers, error: countError } = await supabase
            .from('profiles')
            .select('entry_count', { count: 'exact' })
            .lt('entry_count', achievedMilestone);

          if (countError) {
            console.error('[Goal Achievement] Error calculating percentile:', countError);
          }

          const percentile = totalUsers ? Math.round((totalUsers.length / (users?.length || 1)) * 100) : 80;

          // Predefined achievement messages
          const achievementMessages = [
            `✨ Congrats on completing your ${achievedMilestone}th entry! You are better than ${percentile}% of users.`,
            `🎉 Milestone unlocked: ${achievedMilestone} entries! You're in the top ${100 - percentile}%.`,
            `🏆 Amazing! ${achievedMilestone} entries completed. You're outpacing ${percentile}% of users.`,
            `🌟 Incredible achievement: ${achievedMilestone} entries! You're ahead of ${percentile}% of users.`,
            `🎯 Goal crushed: ${achievedMilestone} entries done! You're performing better than ${percentile}% of users.`,
            `💫 ${achievedMilestone} entries milestone reached! You're in the top ${100 - percentile}% of journalers.`,
            `🚀 ${achievedMilestone} entries and counting! You're outshining ${percentile}% of users.`,
            `👑 ${achievedMilestone} entries achieved! You're among the top ${100 - percentile}% performers.`,
            `🌈 Fantastic! ${achievedMilestone} entries completed. You're ahead of ${percentile}% of users.`,
            `⭐ ${achievedMilestone}-entry champion! You're better than ${percentile}% of users.`
          ];

          const randomMessage = achievementMessages[Math.floor(Math.random() * achievementMessages.length)];
          const userName = user.display_name || user.full_name || 'there';

          // Invoke send-custom-notification function
          const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
            body: {
              userIds: [user.id],
              title: `${achievedMilestone} Entries Milestone!`,
              body: randomMessage,
              type: 'goal_achievement',
              category: 'Reward',
              sendInApp: false, // Only push notifications for status bar
              sendPush: true,
              actionUrl: '/app/insights',
              actionLabel: 'View Achievements',
              data: {
                milestone: achievedMilestone,
                percentile: percentile,
                action: 'open_insights'
              }
            }
          });

          if (notificationError) {
            console.error(`[Goal Achievement] Failed to send notification to user ${user.id}:`, notificationError);
            failedCount++;
          } else {
            console.log(`[Goal Achievement] Sent ${achievedMilestone}-entry milestone to user ${user.id}`);
            sentCount++;
          }
        }
      } catch (error) {
        console.error(`[Goal Achievement] Error processing user ${user.id}:`, error);
        failedCount++;
      }
    }

    console.log(`[Goal Achievement] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Goal achievement notifications processed',
      sent: sentCount,
      failed: failedCount,
      total_users_checked: users?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Goal Achievement] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});