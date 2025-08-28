import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmartChatTriggerRequest {
  userId?: string; // If not provided, will send to all active users
  customMessage?: string;
  triggerCondition?: 'inactivity' | 'new_feature' | 'engagement_boost' | 'manual';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SmartChatTrigger] Processing Smart Chat notification trigger');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request
    const triggerRequest: SmartChatTriggerRequest = await req.json()
    console.log('[SmartChatTrigger] Request:', triggerRequest);

    let targetUserIds: string[] = [];

    // Determine target users
    if (triggerRequest.userId) {
      targetUserIds = [triggerRequest.userId];
    } else {
      // Get active users (users who have logged in within the last 7 days)
      const { data: activeUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100); // Limit to prevent spam

      if (usersError) {
        throw new Error(`Failed to fetch active users: ${usersError.message}`);
      }

      targetUserIds = activeUsers?.map(user => user.id) || [];
    }

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No target users found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Generate custom message based on trigger condition
    const getMessage = (condition: string, customMessage?: string): string => {
      if (customMessage) return customMessage;
      
      switch (condition) {
        case 'inactivity':
          return 'Miss our conversations? Your AI companion is here whenever you need to chat or reflect.';
        case 'new_feature':
          return 'Exciting new features are waiting for you! Start a conversation to explore what\'s new.';
        case 'engagement_boost':
          return 'Your AI companion has new insights to share. Ready for a meaningful conversation?';
        default:
          return 'Your AI companion is ready to chat. Tap to start a conversation!';
      }
    };

    const message = getMessage(triggerRequest.triggerCondition || 'manual', triggerRequest.customMessage);

    // Send notification via custom notification service
    const { data: notificationResult, error: notificationError } = await supabase.functions.invoke('send-custom-notification', {
      body: {
        userIds: targetUserIds,
        title: '💬 Smart Chat Available',
        body: message,
        type: 'smart_chat_invite',
        actionUrl: '/app/smart-chat',
        actionLabel: 'Open Chat',
        sendPush: true,
        sendInApp: true,
        data: {
          trigger_condition: triggerRequest.triggerCondition,
          timestamp: new Date().toISOString()
        }
      }
    });

    if (notificationError) {
      throw new Error(`Failed to send notifications: ${notificationError.message}`);
    }

    console.log('[SmartChatTrigger] Successfully sent notifications to', targetUserIds.length, 'users');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Smart Chat notifications sent to ${targetUserIds.length} users`,
        results: notificationResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[SmartChatTrigger] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})