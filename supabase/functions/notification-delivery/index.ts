import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('[notification-delivery] Starting notification delivery process');

    // Get pending notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabaseClient
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('[notification-delivery] Error fetching notifications:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notification-delivery] Found ${pendingNotifications?.length || 0} pending notifications`);

    let sentCount = 0;
    let failedCount = 0;

    // Process each notification
    for (const notification of pendingNotifications || []) {
      try {
        console.log(`[notification-delivery] Processing notification ${notification.id} for user ${notification.user_id}`);

        // Create the notification payload for the frontend
        const notificationPayload: NotificationPayload = {
          user_id: notification.user_id,
          title: notification.title,
          body: notification.body,
          data: {
            ...notification.data,
            notification_id: notification.id,
            timestamp: new Date().toISOString(),
            type: 'journal_reminder'
          }
        };

        // For now, we'll mark as sent and let the frontend handle the actual notification display
        // In the future, we could integrate with push notification services here
        
        // Update notification status to sent
        const { error: updateError } = await supabaseClient
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error(`[notification-delivery] Error updating notification ${notification.id}:`, updateError);
          failedCount++;
          
          // Mark as failed
          await supabaseClient
            .from('notification_queue')
            .update({
              status: 'failed',
              error_message: updateError.message
            })
            .eq('id', notification.id);
        } else {
          console.log(`[notification-delivery] Successfully processed notification ${notification.id}`);
          sentCount++;
        }

      } catch (error) {
        console.error(`[notification-delivery] Error processing notification ${notification.id}:`, error);
        failedCount++;
        
        // Mark as failed
        await supabaseClient
          .from('notification_queue')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', notification.id);
      }
    }

    console.log(`[notification-delivery] Delivery complete. Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification delivery process completed',
        sent_count: sentCount,
        failed_count: failedCount,
        total_processed: sentCount + failedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notification-delivery] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});