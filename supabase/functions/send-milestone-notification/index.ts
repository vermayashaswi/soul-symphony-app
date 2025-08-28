import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface MilestoneRequest {
  userId?: string
  forceCheck?: boolean
}

// Milestone definitions
const MILESTONES = [
  { count: 50, name: "Chronicle Beginner", emoji: "🌱", message: "You've started your journaling journey!" },
  { count: 100, name: "Reflection Explorer", emoji: "🧭", message: "You're building a strong reflection habit!" },
  { count: 500, name: "Story Weaver", emoji: "📖", message: "Your life story is taking beautiful shape!" },
  { count: 1000, name: "Wisdom Keeper", emoji: "🏛️", message: "You've created a treasure trove of memories!" },
  { count: 2000, name: "Life Chronicler", emoji: "👑", message: "You're a true master of self-reflection!" }
]

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

    const requestData: MilestoneRequest = await req.json().catch(() => ({}))
    
    let targetUserIds: string[] = []
    
    if (requestData.userId) {
      targetUserIds = [requestData.userId]
    } else {
      // Get all users to check their entry counts
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, entry_count')
        .not('entry_count', 'is', null)

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      targetUserIds = users?.map(user => user.id) || []
    }

    console.log(`Checking milestones for ${targetUserIds.length} users`)

    const results = []
    for (const userId of targetUserIds) {
      try {
        // Get user's current entry count
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('entry_count')
          .eq('id', userId)
          .single()

        if (profileError) {
          console.error(`Error fetching profile for user ${userId}:`, profileError)
          continue
        }

        const currentCount = profile?.entry_count || 0
        
        // Check if user has reached any milestone
        const achievedMilestone = MILESTONES.find(milestone => {
          // Check if they just reached this milestone (within the last few entries)
          return currentCount >= milestone.count && currentCount < milestone.count + 10
        })

        if (!achievedMilestone && !requestData.forceCheck) {
          continue
        }

        // If force checking, find the highest achieved milestone
        let milestoneToNotify = achievedMilestone
        if (requestData.forceCheck && !achievedMilestone) {
          milestoneToNotify = MILESTONES
            .filter(m => currentCount >= m.count)
            .sort((a, b) => b.count - a.count)[0]
        }

        if (!milestoneToNotify) {
          console.log(`No milestone reached for user ${userId} (${currentCount} entries)`)
          continue
        }

        // Check if we've already sent this milestone notification recently
        const { data: recentNotification, error: notificationCheckError } = await supabase
          .from('user_app_notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'milestone')
          .contains('data', { milestone_count: milestoneToNotify.count })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
          .limit(1)

        if (notificationCheckError) {
          console.error(`Error checking recent notifications for user ${userId}:`, notificationCheckError)
        }

        if (recentNotification && recentNotification.length > 0 && !requestData.forceCheck) {
          console.log(`Milestone notification already sent recently for user ${userId}`)
          continue
        }

        const title = `${milestoneToNotify.emoji} ${milestoneToNotify.name}`
        const message = `${milestoneToNotify.message} You've reached ${milestoneToNotify.count} entries!`

        // Send in-app notification
        const { error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
          body: {
            userIds: [userId],
            title,
            message,
            type: 'milestone',
            category: 'Informational',
            sendInApp: true, // Only in-app notifications
            sendPush: false,
            actionUrl: '/app/insights',
            actionLabel: 'View Progress',
            data: {
              milestone_count: milestoneToNotify.count,
              milestone_name: milestoneToNotify.name,
              current_entry_count: currentCount,
              emoji: milestoneToNotify.emoji
            }
          }
        })

        if (notificationError) {
          console.error(`Error sending milestone notification to user ${userId}:`, notificationError)
          results.push({ userId, success: false, error: notificationError.message })
        } else {
          console.log(`Milestone notification sent to user ${userId}: ${milestoneToNotify.name}`)
          results.push({ 
            userId, 
            success: true, 
            milestone: milestoneToNotify.name,
            count: milestoneToNotify.count,
            currentEntries: currentCount
          })
        }

      } catch (error) {
        console.error(`Error processing milestone for user ${userId}:`, error)
        results.push({ userId, success: false, error: error.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: targetUserIds.length,
      results,
      milestones: MILESTONES
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in send-milestone-notification function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})