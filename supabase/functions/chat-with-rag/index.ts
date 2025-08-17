
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
      // General mental health queries get conversational responses
      console.log("[chat-with-rag] Providing general mental health response");
      
      const conversationalResponses = [
        "Hello! I'm here to help you with your mental health journey. Feel free to share your thoughts or ask any questions.",
        "Hi there! How are you feeling today? I'm here to listen and support you.",
        "Hey! It's great to connect with you. I'm here to provide support and insights about your mental health.",
        "Hello! I'm glad you're here. Whether you want to chat or explore your thoughts, I'm here to help.",
        "Hi! Thanks for reaching out. I'm here to support your mental health and well-being."
      ];
      
      response = conversationalResponses[Math.floor(Math.random() * conversationalResponses.length)];
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
      // Journal-specific needs clarification
      console.log("[chat-with-rag] Requesting clarification for journal query");
      
      response = "I'd love to help you explore your journal entries! Could you be more specific about what you'd like to know? For example, you could ask about patterns in your mood, specific themes, or insights from particular time periods.";
      metadata = {
        classification: classification,
        userTimezone: userTimezone,
        responseType: 'clarification'
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
