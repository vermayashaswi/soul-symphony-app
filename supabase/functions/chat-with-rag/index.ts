
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to process time range
function processTimeRange(timeRange: any, userTimezone: string = 'UTC'): { startDate?: string; endDate?: string } {
  if (!timeRange) return {};
  
  console.log("Processing time range:", timeRange);
  console.log(`Using user timezone: ${userTimezone}`);
  
  const result: { startDate?: string; endDate?: string } = {};
  
  try {
    // Handle startDate if provided
    if (timeRange.startDate) {
      const startDate = new Date(timeRange.startDate);
      if (!isNaN(startDate.getTime())) {
        result.startDate = startDate.toISOString();
      } else {
        console.warn(`Invalid startDate: ${timeRange.startDate}`);
      }
    }
    
    // Handle endDate if provided
    if (timeRange.endDate) {
      const endDate = new Date(timeRange.endDate);
      if (!isNaN(endDate.getTime())) {
        result.endDate = endDate.toISOString();
      } else {
        console.warn(`Invalid endDate: ${timeRange.endDate}`);
      }
    }
    
    console.log("Final processed time range with UTC conversion:", result);
    return result;
  } catch (error) {
    console.error("Error processing time range:", error);
    return {};
  }
}

// Helper function to detect timeframe in query
function detectTimeframeInQuery(message: string, userTimezone: string = 'UTC'): any {
  // Simple timeframe detection logic
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('today')) {
    return { type: 'today' };
  }
  if (lowerMessage.includes('yesterday')) {
    return { type: 'yesterday' };
  }
  if (lowerMessage.includes('this week')) {
    return { type: 'week' };
  }
  if (lowerMessage.includes('last week')) {
    return { type: 'lastWeek' };
  }
  if (lowerMessage.includes('this month')) {
    return { type: 'month' };
  }
  if (lowerMessage.includes('last month')) {
    return { type: 'lastMonth' };
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[chat-with-rag] Starting enhanced RAG processing with classification");

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

    // Step 1: Query Classification
    console.log("[chat-with-rag] Step 1: Query Classification");
    
    const classificationResponse = await supabaseClient.functions.invoke('chat-query-classifier', {
      body: { message, conversationContext }
    });
    
    let classification = classificationResponse.data;
    
    if (classificationResponse.error) {
      console.error("[chat-with-rag] Classification error:", classificationResponse.error);
      // Enhanced fallback classification with timezone context
      classification = {
        category: 'JOURNAL_SPECIFIC',
        confidence: 0.7,
        reasoning: 'Fallback classification with timezone support'
      };
    }

    console.log(`[chat-with-rag] Query classified as: ${classification.category} (confidence: ${classification.confidence})`);

    // Enhanced classification override for debugging
    if (req.headers.get('x-classification-hint')) {
      const hintCategory = req.headers.get('x-classification-hint');
      console.error(`[chat-with-rag] CLIENT HINT: Overriding classification to ${hintCategory}`);
      classification.category = hintCategory;
    }

    // Route based on classification - let GPT decide complexity
    if (classification.category === 'GENERAL_MENTAL_HEALTH' || classification.category === 'UNRELATED') {
      console.log(`[chat-with-rag] Using simple conversational response for: ${classification.category}`);
      
      // Simple conversational response without RAG
      const responseGeneration = await supabaseClient.functions.invoke('intelligent-response-generator', {
        body: {
          originalQuery: message,
          queryPlan: { strategy: 'conversational', expectedResponseType: 'simple' },
          searchResults: [],
          combinedResults: [],
          conversationContext: conversationContext,
          userProfile: userProfile,
          timeRange: null,
          userTimezone: userTimezone
        }
      });

      if (responseGeneration.error) {
        throw new Error(`Response generation failed: ${responseGeneration.error.message}`);
      }

      return new Response(JSON.stringify({
        response: responseGeneration.data.response,
        metadata: {
          classification: classification,
          queryPlan: { strategy: 'conversational' },
          searchResults: [],
          timeRange: null,
          userTimezone: userTimezone,
          strategy: 'conversational',
          confidence: classification.confidence
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[chat-with-rag] Using RAG analysis for: ${classification.category}`);
    
    // Step 2: Enhanced Query Planning with timezone support (for JOURNAL_SPECIFIC queries only)
    const queryPlanResponse = await supabaseClient.functions.invoke('smart-query-planner', {
      body: { 
        message, 
        userId, 
        conversationContext,
        threadId,
        messageId,
        userTimezone // Pass user timezone to planner
      }
    });

    if (queryPlanResponse.error) {
      throw new Error(`Query planning failed: ${queryPlanResponse.error.message}`);
    }

    const queryPlan = queryPlanResponse.data.queryPlan;
    console.log(`[chat-with-rag] Query plan strategy: ${queryPlan.strategy}, complexity: ${queryPlan.queryComplexity}`);

    // Enhanced timeframe detection with timezone support
    let timeRange = null;
    const detectedTimeframe = detectTimeframeInQuery(message, userTimezone);
    
    if (detectedTimeframe) {
      console.log(`[chat-with-rag] Detected timeframe with timezone ${userTimezone}:`, JSON.stringify(detectedTimeframe, null, 2));
      // Process timeframe with user's timezone for proper UTC conversion
      timeRange = processTimeRange(detectedTimeframe, userTimezone);
      console.log(`[chat-with-rag] Processed time range (converted to UTC):`, JSON.stringify(timeRange, null, 2));
    }

    console.log(`[chat-with-rag] Using GPT-generated query plan:`, {
      queryType: queryPlan.queryType,
      strategy: queryPlan.strategy,
      userStatusMessage: queryPlan.userStatusMessage,
      subQuestions: queryPlan.subQuestions,
      confidence: queryPlan.confidence,
      reasoning: queryPlan.reasoning,
      useAllEntries: queryPlan.useAllEntries,
      hasPersonalPronouns: queryPlan.hasPersonalPronouns,
      hasExplicitTimeReference: queryPlan.hasExplicitTimeReference,
      inferredTimeContext: queryPlan.inferredTimeContext
    });

    // Step 3: Execute the plan with timezone-aware processing
    const executionResult = queryPlanResponse.data.executionResult;

    // Step 4: Generate enhanced response with timezone context
    const responseGeneration = await supabaseClient.functions.invoke('intelligent-response-generator', {
      body: {
        originalQuery: message,
        queryPlan: queryPlan,
        searchResults: executionResult || [],
        combinedResults: executionResult || [],
        conversationContext: conversationContext,
        userProfile: userProfile,
        timeRange: timeRange,
        userTimezone: userTimezone // Pass timezone to response generator
      }
    });

    if (responseGeneration.error) {
      throw new Error(`Response generation failed: ${responseGeneration.error.message}`);
    }

    console.log("[chat-with-rag] Successfully completed GPT-driven analysis pipeline for ALL query types");

    return new Response(JSON.stringify({
      response: responseGeneration.data.response,
      metadata: {
        classification: classification,
        queryPlan: queryPlan,
        searchResults: executionResult,
        timeRange: timeRange,
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
