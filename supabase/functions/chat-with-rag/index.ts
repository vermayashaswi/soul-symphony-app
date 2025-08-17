
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log("[chat-with-rag] Starting GPT-driven RAG processing");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { 
      message, 
      userId, 
      threadId = null, 
      messageId = null,
      conversationContext = [],
      userProfile = null
    } = await req.json();

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${userId} (threadId: ${threadId}, messageId: ${messageId})`);
    
    // Extract user timezone from profile or default to UTC
    const userTimezone = userProfile?.timezone || 'UTC';
    console.log(`[chat-with-rag] User timezone: ${userTimezone}`);

    // Direct to smart query planner - GPT decides everything
    console.log("[chat-with-rag] Invoking smart query planner");
    
    const queryPlanResponse = await supabaseClient.functions.invoke('smart-query-planner', {
      body: { 
        message, 
        userId, 
        conversationContext,
        threadId,
        messageId,
        userTimezone
      }
    });

    if (queryPlanResponse.error) {
      throw new Error(`Query planning failed: ${queryPlanResponse.error.message}`);
    }

    const queryPlan = queryPlanResponse.data.queryPlan;
    const executionResult = queryPlanResponse.data.executionResult;
    
    console.log(`[chat-with-rag] GPT query plan:`, queryPlan);

    // Generate response using GPT's plan and results
    const responseGeneration = await supabaseClient.functions.invoke('intelligent-response-generator', {
      body: {
        originalQuery: message,
        queryPlan: queryPlan,
        searchResults: executionResult || [],
        combinedResults: executionResult || [],
        conversationContext: conversationContext,
        userProfile: userProfile,
        userTimezone: userTimezone
      }
    });

    if (responseGeneration.error) {
      throw new Error(`Response generation failed: ${responseGeneration.error.message}`);
    }

    console.log("[chat-with-rag] GPT-driven pipeline completed");

    return new Response(JSON.stringify({
      response: responseGeneration.data.response,
      metadata: {
        queryPlan: queryPlan,
        searchResults: executionResult,
        userTimezone: userTimezone,
        strategy: queryPlan.strategy,
        confidence: queryPlan.confidence
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to process query with RAG pipeline',
      details: error.message,
      fallbackResponse: "I apologize, but I'm having trouble processing your request right now. Please try rephrasing your question or try again later."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
