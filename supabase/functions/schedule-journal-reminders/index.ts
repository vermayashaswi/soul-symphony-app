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

    console.log('[Scheduler] Running journal reminder check...');

    // Get current time in UTC
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    console.log('[Scheduler] Current UTC time:', currentTime, 'Full timestamp:', now.toISOString());

    // Find active notifications scheduled for this time (exact hour:minute match)
    const { data: scheduledNotifications, error: notificationsError } = await supabase
      .from('user_notifications')
      .select(`
        *,
        profiles!inner(id, full_name, display_name, timezone)
      `)
      .eq('status', 'active')
      .eq('type', 'journal_reminder')
      .eq('scheduled_time', currentTime);

    if (notificationsError) {
      console.error('[Scheduler] Error fetching notifications:', notificationsError);
      throw notificationsError;
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      console.log('[Scheduler] No notifications to send at this time');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No notifications scheduled for this time',
        currentTime 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[Scheduler] Found notifications to send:', scheduledNotifications.length);

    // Send FCM notifications for each scheduled reminder
    const notificationResults = [];
    for (const notification of scheduledNotifications) {
      try {
        const userName = notification.profiles?.display_name || notification.profiles?.full_name || 'there';
        
        // Personalized messages
        const messages = [
          `Hi ${userName}! Time for your daily reflection 📝`,
          `${userName}, take a moment to journal your thoughts 💭`,
          `Your mindful moment awaits, ${userName} ✨`,
          `Time to capture today's insights, ${userName} 🌟`,
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        // Call the FCM notification function
        const fcmResponse = await supabase.functions.invoke('send-fcm-notification', {
          body: {
            userIds: [notification.user_id],
            title: notification.title,
            body: randomMessage,
            data: {
              type: 'journal_reminder',
              reminder_id: notification.id,
            },
            actionUrl: 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com/app/journal'
          }
        });

        notificationResults.push({
          userId: notification.user_id,
          notificationId: notification.id,
          success: !fcmResponse.error,
          error: fcmResponse.error?.message
        });

        console.log('[Scheduler] Sent notification to user:', notification.user_id);

      } catch (error) {
        console.error('[Scheduler] Error sending notification to user:', notification.user_id, error);
        notificationResults.push({
          userId: notification.user_id,
          notificationId: notification.id,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = notificationResults.filter(r => r.success).length;
    const failureCount = notificationResults.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${scheduledNotifications.length} scheduled notifications`,
      currentTime,
      results: {
        success: successCount,
        failures: failureCount,
        details: notificationResults
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('[Scheduler] Error in scheduler:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});