import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  userId: string;
  threadId: string;
  conversationContext?: any[];
  userProfile?: any;
  category?: string;
}

interface SupabaseClient {
  from: (table: string) => any;
  functions: {
    invoke: (functionName: string, options: { body: any }) => Promise<{ data: any; error: any }>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, conversationContext = [], userProfile = {}, category }: ChatRequest = await req.json();

    console.log(`[chat-with-rag] Processing message for user ${userId}, thread ${threadId}, category: ${category}`);

    if (!message || !userId || !threadId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: message, userId, threadId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as SupabaseClient;

    // Save user message immediately
    const { error: saveMessageError } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      content: message,
      sender: 'user',
      user_id: userId,
      created_at: new Date().toISOString()
    });

    if (saveMessageError) {
      console.error('[chat-with-rag] Error saving user message:', saveMessageError);
    }

    let response = '';
    let userStatusMessage = '';
    let metadata = {};

    // Route based on category
    if (category === 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION') {
      console.log('[chat-with-rag] Handling clarification request');
      
      const { data: clarificationData, error: clarificationError } = await supabase.functions.invoke('gpt-clarification-generator', {
        body: { 
          message, 
          conversationContext,
          userProfile 
        }
      });

      if (clarificationError) {
        console.error('[chat-with-rag] Clarification error:', clarificationError);
        response = "I need more details to help you with your journal analysis. Could you please provide more specific information about what you'd like to explore?";
      } else {
        response = clarificationData.clarificationPrompt || clarificationData.response || "Could you please provide more details about what you'd like to explore in your journal entries?";
      }

    } else if (category === 'JOURNAL_SPECIFIC') {
      console.log('[chat-with-rag] Processing journal-specific query');
      
      // Set user status message for journal processing
      userStatusMessage = "Analyzing your journal entries...";

      // Process with smart query planner
      const { data: plannerData, error: plannerError } = await supabase.functions.invoke('smart-query-planner', {
        body: {
          message,
          userId,
          conversationContext,
          userProfile
        }
      });

      if (plannerError) {
        console.error('[chat-with-rag] Smart query planner error:', plannerError);
        response = "I encountered an issue analyzing your journal entries. Please try again or rephrase your question.";
      } else {
        response = plannerData.response || plannerData.consolidatedResponse || "I've analyzed your journal entries but couldn't generate a complete response.";
        metadata = plannerData.metadata || {};
      }

    } else if (category === 'GENERAL_MENTAL_HEALTH') {
      console.log('[chat-with-rag] Handling general mental health query');
      
      const { data: mentalHealthData, error: mentalHealthError } = await supabase.functions.invoke('general-mental-health-chat', {
        body: {
          message,
          conversationContext,
          userProfile
        }
      });

      if (mentalHealthError) {
        console.error('[chat-with-rag] Mental health chat error:', mentalHealthError);
        response = "I'm here to support you. Could you tell me more about what's on your mind?";
      } else {
        response = mentalHealthData.response || "I'm here to support you. Could you tell me more about what's on your mind?";
      }

    } else {
      // Default fallback for unrelated or unclassified
      console.log('[chat-with-rag] Using default fallback response');
      response = "I'm focused on helping with mental health and journal insights. Is there something specific about your wellbeing or journal entries you'd like to explore?";
    }

    // Save assistant response
    const { error: saveResponseError } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      content: response,
      sender: 'assistant',
      user_id: userId,
      created_at: new Date().toISOString(),
      analysis_data: metadata
    });

    if (saveResponseError) {
      console.error('[chat-with-rag] Error saving assistant response:', saveResponseError);
    }

    // Return response with metadata
    const result = {
      response,
      userStatusMessage,
      metadata,
      category,
      threadId
    };

    console.log(`[chat-with-rag] Successfully processed message for thread ${threadId}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[chat-with-rag] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});