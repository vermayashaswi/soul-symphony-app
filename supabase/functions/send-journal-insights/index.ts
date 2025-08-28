import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

interface JournalInsightRequest {
  targetUserIds?: string[]
  customMessage?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestData: JournalInsightRequest = await req.json().catch(() => ({}))
    
    let targetUserIds = requestData.targetUserIds || []

    // If no specific users, get all active users
    if (targetUserIds.length === 0) {
      const { data: activeUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (usersError) {
        console.error('Error fetching active users:', usersError)
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      targetUserIds = activeUsers?.map(user => user.id) || []
    }

    console.log(`Processing journal insights for ${targetUserIds.length} users`)

    const results = []
    for (const userId of targetUserIds) {
      try {
        // Get user's journal entries from the past week
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        
        const { data: entries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('themes, master_themes, created_at')
          .eq('user_id', userId)
          .gte('created_at', weekAgo)
          .order('created_at', { ascending: false })

        if (entriesError) {
          console.error(`Error fetching entries for user ${userId}:`, entriesError)
          continue
        }

        if (!entries || entries.length === 0) {
          console.log(`No entries found for user ${userId} in the past week`)
          continue
        }

        // Extract and analyze themes
        const allThemes = new Set<string>()
        entries.forEach(entry => {
          if (entry.themes) {
            entry.themes.forEach((theme: string) => allThemes.add(theme))
          }
          if (entry.master_themes) {
            entry.master_themes.forEach((theme: string) => allThemes.add(theme))
          }
        })

        const uniqueThemes = Array.from(allThemes)
        
        if (uniqueThemes.length === 0) {
          console.log(`No themes found for user ${userId}`)
          continue
        }

        // Generate AI insight message
        let insightMessage = requestData.customMessage
        
        if (!insightMessage && OPENAI_API_KEY) {
          try {
            const prompt = `You are SOULo, a warm and insightful AI companion for a journaling app. 

Based on the themes from a user's journal entries over the past week, create a brief, encouraging insight message for an in-app notification.

Themes from this week: ${uniqueThemes.join(', ')}
Number of entries: ${entries.length}

Guidelines:
- Keep it under 100 characters for notification display
- Be warm, supportive, and insightful
- Focus on patterns or growth opportunities
- Use "you" to address the user directly
- Make it feel personal but not invasive
- Include a relevant emoji if appropriate

Generate only the insight message, nothing else.`

            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150,
                temperature: 0.7
              }),
            })

            if (openaiResponse.ok) {
              const openaiData = await openaiResponse.json()
              insightMessage = openaiData.choices[0]?.message?.content?.trim()
            } else {
              console.error('OpenAI API error:', await openaiResponse.text())
            }
          } catch (error) {
            console.error('Error calling OpenAI:', error)
          }
        }

        // Fallback message if AI generation fails
        if (!insightMessage) {
          const topTheme = uniqueThemes[0]
          insightMessage = `💭 You've been reflecting on ${topTheme} often this week. Notice any patterns?`
        }

        // Send in-app notification
        const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
          body: {
            userIds: [userId],
            title: 'Weekly Journal Insights',
            message: insightMessage,
            type: 'journal_insights',
            category: 'Informational',
            sendInApp: true, // Only in-app notifications
            sendPush: false,
            actionUrl: '/app/journal?tab=record',
            actionLabel: 'View Entries',
            data: {
              themes_analyzed: uniqueThemes,
              entries_count: entries.length,
              week_start: weekAgo,
              insight_generated: !!OPENAI_API_KEY
            }
          }
        })

        if (notificationError) {
          console.error(`Error sending notification to user ${userId}:`, notificationError)
          results.push({ userId, success: false, error: notificationError.message })
        } else {
          console.log(`Journal insight sent to user ${userId}`)
          results.push({ userId, success: true, message: insightMessage })
        }

      } catch (error) {
        console.error(`Error processing user ${userId}:`, error)
        results.push({ userId, success: false, error: error.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: targetUserIds.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in send-journal-insights function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})