import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('[Mood Tracking Prompt] Starting mood tracking prompt generation...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request to see if checking for specific user
    let specificUserId = null;
    try {
      const body = await req.json();
      specificUserId = body.user_id;
    } catch (e) {
      console.log('[Mood Tracking Prompt] No specific user provided, checking all eligible users');
    }

    // Find users who have exactly 10, 20, 30, etc. entries and haven't gotten a mood prompt in the last 6 hours
    let query = supabase
      .from('profiles')
      .select('id, display_name, full_name, entry_count, timezone')
      .gte('entry_count', 10);

    if (specificUserId) {
      query = query.eq('id', specificUserId);
    }

    const { data: potentialUsers, error: usersError } = await query;

    if (usersError) {
      console.error('[Mood Tracking Prompt] Error fetching users:', usersError);
      throw usersError;
    }

    // Filter users who have multiples of 10 entries
    const eligibleUsers = potentialUsers?.filter(user => 
      user.entry_count && user.entry_count % 10 === 0
    ) || [];

    console.log(`[Mood Tracking Prompt] Found ${eligibleUsers.length} eligible users`);

    let sentCount = 0;
    let failedCount = 0;

    for (const user of eligibleUsers) {
      try {
        // Check if user already got a mood tracking prompt in last 6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const { data: recentPrompt } = await supabase
          .from('user_app_notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'mood_tracking_prompt')
          .gte('created_at', sixHoursAgo)
          .single();

        if (recentPrompt) {
          console.log(`[Mood Tracking Prompt] User ${user.id} already got prompt in last 6 hours`);
          continue;
        }

        // Get last 10 journal entries for this user to analyze themes
        const { data: recentEntries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('themes, master_themes, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (entriesError) {
          console.error(`[Mood Tracking Prompt] Error fetching entries for user ${user.id}:`, entriesError);
          failedCount++;
          continue;
        }

        if (!recentEntries || recentEntries.length === 0) {
          console.log(`[Mood Tracking Prompt] No entries found for user ${user.id}`);
          continue;
        }

        // Extract themes from recent entries
        const allThemes = [];
        for (const entry of recentEntries) {
          if (entry.master_themes) {
            allThemes.push(...entry.master_themes);
          }
          if (entry.themes) {
            allThemes.push(...entry.themes);
          }
        }

        const uniqueThemes = [...new Set(allThemes)].slice(0, 10); // Get unique themes, max 10

        console.log(`[Mood Tracking Prompt] User ${user.id} themes:`, uniqueThemes.join(', '));

        if (uniqueThemes.length === 0) {
          console.log(`[Mood Tracking Prompt] No themes found for user ${user.id}`);
          continue;
        }

        // Generate personalized prompt using GPT-4.1-nano
        const gptPrompt = `You are the notification planner for a voice journaling app called SOuLO. Provided to you are themes that emerged from the last few entries of the user. Create a brief notification content (15-30 words max) that seems most logical and would push user to journal more on SOuLO. 

Examples:
- "Last time we spoke about your celebration of football and scoring 5 goals. How's that going? Playing again these days?"
- "You mentioned work stress and team conflicts. How are things at the office now?"
- "Remember when you talked about family time and weekend plans? How did that turn out?"

User's recent themes: ${uniqueThemes.join(', ')}

Create a personalized, engaging notification that references their themes and encourages them to journal:`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-nano-2025-04-14',
            max_completion_tokens: 60,
            messages: [
              { role: 'system', content: 'You are a helpful assistant that creates personalized notification messages for a journaling app.' },
              { role: 'user', content: gptPrompt }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`[Mood Tracking Prompt] OpenAI API error for user ${user.id}:`, response.status);
          failedCount++;
          continue;
        }

        const data = await response.json();
        const personalizedMessage = data.choices[0].message.content.trim();

        console.log(`[Mood Tracking Prompt] Generated message for user ${user.id}: ${personalizedMessage}`);

        const userName = user.display_name || user.full_name || 'there';

        // Invoke send-custom-notification function
        const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
          body: {
            userIds: [user.id],
            title: 'How are you feeling today?',
            body: personalizedMessage,
            type: 'mood_tracking_prompt',
            category: 'Engagement',
            sendInApp: false, // Only push notifications for status bar
            sendPush: true,
            actionUrl: '/app/journal?tab=record',
            actionLabel: 'Record Entry',
            data: {
              entry_count: user.entry_count,
              themes_analyzed: uniqueThemes,
              action: 'open_journal'
            }
          }
        });

        if (notificationError) {
          console.error(`[Mood Tracking Prompt] Failed to send notification to user ${user.id}:`, notificationError);
          failedCount++;
        } else {
          console.log(`[Mood Tracking Prompt] Sent personalized mood prompt to user ${user.id}`);
          sentCount++;
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[Mood Tracking Prompt] Error processing user ${user.id}:`, error);
        failedCount++;
      }
    }

    console.log(`[Mood Tracking Prompt] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Mood tracking prompt notifications processed',
      sent: sentCount,
      failed: failedCount,
      total_eligible_users: eligibleUsers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Mood Tracking Prompt] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});