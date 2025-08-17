
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

    // First classify the message to determine routing
    console.log("[chat-with-rag] Classifying message");
    
    const classificationResponse = await supabaseClient.functions.invoke('chat-query-classifier', {
      body: { 
        message, 
        conversationContext
      }
    });

    if (classificationResponse.error) {
      throw new Error(`Classification failed: ${classificationResponse.error.message}`);
    }

    const classification = classificationResponse.data.category;
    console.log(`[chat-with-rag] Message classified as: ${classification}`);

    let response, metadata;

    if (classification === 'JOURNAL_SPECIFIC') {
      // Journal-specific queries go through full RAG pipeline
      console.log("[chat-with-rag] Routing to smart-query-planner for journal analysis");
      
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

      // Generate response using GPT's plan and results via consolidator
      const responseGeneration = await supabaseClient.functions.invoke('gpt-response-consolidator', {
        body: {
          userMessage: message,
          researchResults: executionResult || [],
          conversationContext: conversationContext,
          userProfile: userProfile,
          threadId: threadId,
          messageId: messageId
        }
      });

      if (responseGeneration.error) {
        throw new Error(`Response generation failed: ${responseGeneration.error.message}`);
      }

      response = responseGeneration.data.response;
      metadata = {
        classification: classification,
        queryPlan: queryPlan,
        searchResults: executionResult,
        userTimezone: userTimezone,
        strategy: queryPlan.strategy,
        confidence: queryPlan.confidence
      };

    } else if (classification === 'GENERAL_MENTAL_HEALTH') {
      // General mental health queries get routed to dedicated edge function
      console.log("[chat-with-rag] Routing to general-mental-health-chat");
      
      const generalHealthResponse = await supabaseClient.functions.invoke('general-mental-health-chat', {
        body: {
          message: message,
          conversationContext: conversationContext
        }
      });

      if (generalHealthResponse.error) {
        throw new Error(`General mental health response failed: ${generalHealthResponse.error.message}`);
      }

      response = generalHealthResponse.data.response;
      metadata = {
        classification: classification,
        userTimezone: userTimezone,
        responseType: 'conversational'
      };

    } else if (classification === 'UNRELATED') {
      // Unrelated queries get polite redirect
      console.log("[chat-with-rag] Redirecting unrelated query");
      
      response = "I'm designed to help with mental health and personal reflection through journal analysis. I'd be happy to help you explore your thoughts, feelings, or analyze patterns in your journaling. What would you like to discuss about your mental health or journal entries?";
      metadata = {
        classification: classification,
        userTimezone: userTimezone,
        responseType: 'redirect'
      };

    } else {
      // Journal-specific needs clarification - route to clarification generator
      console.log("[chat-with-rag] Routing to gpt-clarification-generator");
      
      const clarificationResponse = await supabaseClient.functions.invoke('gpt-clarification-generator', {
        body: {
          userMessage: message,
          conversationContext: conversationContext,
          userProfile: userProfile
        }
      });

      if (clarificationResponse.error) {
        throw new Error(`Clarification generation failed: ${clarificationResponse.error.message}`);
      }

      response = clarificationResponse.data.response;
      metadata = {
        classification: classification,
        userTimezone: userTimezone,
        responseType: 'clarification',
        userStatusMessage: clarificationResponse.data.userStatusMessage
      };
    }

    console.log("[chat-with-rag] Response generation completed");

    return new Response(JSON.stringify({
      response: response,
      metadata: metadata
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
