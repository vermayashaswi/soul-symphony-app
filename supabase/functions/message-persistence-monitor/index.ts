import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { threadId, userId, messageId, action = 'check' } = await req.json();
    
    console.log(`[PERSISTENCE MONITOR] Action: ${action}, Thread: ${threadId}, User: ${userId}, Message: ${messageId}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'check') {
      // Check message persistence health for a thread
      const { data: messages, error } = await supabaseClient
        .from('chat_messages')
        .select('id, sender, content, created_at, is_processing')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const userMessages = messages?.filter(m => m.sender === 'user') || [];
      const assistantMessages = messages?.filter(m => m.sender === 'assistant') || [];
      const processingMessages = messages?.filter(m => m.is_processing) || [];

      const healthScore = Math.max(0, 100 - (processingMessages.length * 25));
      
      const result = {
        threadId,
        totalMessages: messages?.length || 0,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        processingMessages: processingMessages.length,
        healthScore,
        isHealthy: healthScore >= 80,
        issues: [
          ...(processingMessages.length > 0 ? [`${processingMessages.length} messages stuck in processing`] : []),
          ...(userMessages.length > assistantMessages.length + 1 ? ['Potential missing assistant responses'] : [])
        ],
        checkedAt: new Date().toISOString()
      };

      console.log(`[PERSISTENCE MONITOR] Thread health:`, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'cleanup') {
      // Clean up stuck processing messages
      const { data: updatedMessages, error } = await supabaseClient
        .from('chat_messages')
        .update({ 
          is_processing: false,
          content: 'Sorry, there was an issue processing your request. Please try again.'
        })
        .eq('thread_id', threadId)
        .eq('is_processing', true)
        .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes ago
        .select('id');

      if (error) {
        throw error;
      }

      console.log(`[PERSISTENCE MONITOR] Cleaned up ${updatedMessages?.length || 0} stuck messages`);

      return new Response(JSON.stringify({
        success: true,
        cleanedMessages: updatedMessages?.length || 0,
        cleanedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'recover') {
      // Attempt to recover a missing assistant response
      if (!messageId) {
        throw new Error('messageId required for recovery action');
      }

      // Direct message insertion without idempotency
      const { data: newMessage, error: messageError } = await supabaseClient
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          sender: 'assistant',
          content: 'I apologize, but there was an issue with my previous response. Could you please repeat your question so I can help you properly?',
          is_processing: false,
          request_correlation_id: `recovery_${messageId}`
        })
        .select()
        .single();

      console.log(`[PERSISTENCE MONITOR] Recovery attempt for thread ${threadId}:`, { success: !messageError, messageId: newMessage?.id, error: messageError });

      return new Response(JSON.stringify({
        success: !messageError,
        messageId: newMessage?.id,
        error: messageError?.message,
        recoveredAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('[PERSISTENCE MONITOR] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});