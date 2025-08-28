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
    console.log('[Notification Scheduler] Starting notification scheduler...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      inactivity_nudge: { sent: 0, failed: 0 },
      streak_reward: { sent: 0, failed: 0 },
      goal_achievement: { sent: 0, failed: 0 },
      mood_tracking_prompt: { sent: 0, failed: 0 },
      sleep_reflection: { sent: 0, failed: 0 }
    };

    // Run all notification types in parallel
    const notificationPromises = [
      // Inactivity nudges for different timeframes
      supabase.functions.invoke('send-inactivity-nudge', { body: { days: 3 } }),
      supabase.functions.invoke('send-inactivity-nudge', { body: { days: 7 } }),
      supabase.functions.invoke('send-inactivity-nudge', { body: { days: 15 } }),
      supabase.functions.invoke('send-inactivity-nudge', { body: { days: 30 } }),
      
      // Other notification types
      supabase.functions.invoke('send-streak-reward'),
      supabase.functions.invoke('send-goal-achievement'),
      supabase.functions.invoke('send-mood-tracking-prompt'),
      supabase.functions.invoke('send-sleep-reflection')
    ];

    const notificationResults = await Promise.allSettled(notificationPromises);

    // Process results
    let totalSent = 0;
    let totalFailed = 0;

    notificationResults.forEach((result, index) => {
      const types = [
        'inactivity_nudge_3d', 'inactivity_nudge_7d', 'inactivity_nudge_15d', 'inactivity_nudge_30d',
        'streak_reward', 'goal_achievement', 'mood_tracking_prompt', 'sleep_reflection'
      ];
      
      const type = types[index];
      
      if (result.status === 'fulfilled' && result.value.data) {
        const data = result.value.data;
        const sent = data.sent || 0;
        const failed = data.failed || 0;
        
        totalSent += sent;
        totalFailed += failed;
        
        console.log(`[Notification Scheduler] ${type}: ${sent} sent, ${failed} failed`);
      } else {
        console.error(`[Notification Scheduler] ${type} failed:`, result);
        totalFailed++;
      }
    });

    console.log(`[Notification Scheduler] Total: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: 'All notification types processed',
      summary: {
        total_sent: totalSent,
        total_failed: totalFailed,
        timestamp: new Date().toISOString()
      },
      detailed_results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Notification Scheduler] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
