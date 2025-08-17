
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Import date-fns functions directly since we can't import from other edge function files
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Copy the essential functions from dateProcessor.ts directly into this file
function detectTimeframeInQuery(message: string, userTimezone: string = 'UTC'): any {
  const lowerMessage = message.toLowerCase();
  
  // Simple timeframe detection logic
  if (lowerMessage.includes('this week') || lowerMessage.includes('current week')) {
    return { type: 'week' };
  } else if (lowerMessage.includes('last week') || lowerMessage.includes('previous week')) {
    return { type: 'lastWeek' };
  } else if (lowerMessage.includes('this month') || lowerMessage.includes('current month')) {
    return { type: 'month' };
  } else if (lowerMessage.includes('last month') || lowerMessage.includes('previous month')) {
    return { type: 'lastMonth' };
  }
  
  // Check for specific month names
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december'];
  
  for (const month of months) {
    if (lowerMessage.includes(month)) {
      return { type: 'specificMonth', monthName: month };
    }
  }
  
  return null;
}

function processTimeRange(timeRange: any, userTimezone: string = 'UTC'): { startDate?: string; endDate?: string } {
  if (!timeRange) return {};
  
  console.log("Processing time range:", timeRange);
  console.log(`Using user timezone: ${userTimezone}`);
  
  const result: { startDate?: string; endDate?: string } = {};
  
  try {
    // Calculate current date in user's timezone
    const now = userTimezone ? toZonedTime(new Date(), userTimezone) : new Date();
    console.log(`Current date in timezone ${userTimezone}: ${now.toISOString()}`);
    
    // Handle special time range cases
    if (timeRange.type === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      
      result.startDate = weekStart.toISOString();
      result.endDate = weekEnd.toISOString();
      
      console.log(`Generated 'this week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastWeek') {
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      result.startDate = lastWeekMonday.toISOString();
      result.endDate = lastWeekSunday.toISOString();
      
      console.log(`Generated 'last week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'month') {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      
      result.startDate = monthStart.toISOString();
      result.endDate = monthEnd.toISOString();
      
      console.log(`Generated 'this month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStart = startOfMonth(lastMonth);
      const lastMonthEnd = endOfMonth(lastMonth);
      
      result.startDate = lastMonthStart.toISOString();
      result.endDate = lastMonthEnd.toISOString();
      
      console.log(`Generated 'last month' date range: ${result.startDate} to ${result.endDate}`);
    }
    
    console.log("Final processed time range:", result);
    return result;
  } catch (error) {
    console.error("Error processing time range:", error);
    return {};
  }
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

    if (classification.category === 'JOURNAL_SPECIFIC') {
      console.log("[chat-with-rag] EXECUTING: JOURNAL_SPECIFIC pipeline - full RAG processing");
      
      // Step 2: Enhanced Query Planning with timezone support
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
      const executionResult = queryPlanResponse.data.executionResult;
      
      console.log(`[chat-with-rag] Query plan strategy: ${queryPlan.strategy}, complexity: ${queryPlan.queryComplexity}`);
      console.log(`[chat-with-rag] Execution result summary:`, {
        resultCount: executionResult?.length || 0,
        hasResults: !!executionResult && executionResult.length > 0
      });

      // Enhanced timeframe detection with timezone support
      let timeRange = null;
      const detectedTimeframe = detectTimeframeInQuery(message, userTimezone);
      
      if (detectedTimeframe) {
        console.log(`[chat-with-rag] Detected timeframe with timezone ${userTimezone}:`, JSON.stringify(detectedTimeframe, null, 2));
        // Process timeframe with user's timezone for proper UTC conversion
        timeRange = processTimeRange(detectedTimeframe, userTimezone);
        console.log(`[chat-with-rag] Processed time range (converted to UTC):`, JSON.stringify(timeRange, null, 2));
      }

      // Step 3: Generate consolidated response using gpt-response-consolidator
      console.log("[chat-with-rag] Step 3: Calling gpt-response-consolidator");
      
      const consolidationResponse = await supabaseClient.functions.invoke('gpt-response-consolidator', {
        body: {
          userMessage: message,
          researchResults: executionResult || [], // Map executionResult to researchResults
          conversationContext: conversationContext,
          userProfile: userProfile,
          streamingMode: false,
          messageId: messageId,
          threadId: threadId
        }
      });

      if (consolidationResponse.error) {
        console.error("[chat-with-rag] Consolidation error:", consolidationResponse.error);
        throw new Error(`Response consolidation failed: ${consolidationResponse.error.message}`);
      }

      console.log("[chat-with-rag] Successfully completed RAG pipeline with consolidation");

      return new Response(JSON.stringify({
        response: consolidationResponse.data.response,
        userStatusMessage: consolidationResponse.data.userStatusMessage,
        metadata: {
          classification: classification,
          queryPlan: queryPlan,
          searchResults: executionResult,
          timeRange: timeRange,
          userTimezone: userTimezone,
          strategy: queryPlan.strategy,
          confidence: queryPlan.confidence,
          analysisMetadata: consolidationResponse.data.analysisMetadata
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Handle non-journal queries using gpt-response-consolidator with empty results
      console.log(`[chat-with-rag] EXECUTING: ${classification.category} pipeline - general response`);
      
      const generalResponse = await supabaseClient.functions.invoke('gpt-response-consolidator', {
        body: {
          userMessage: message,
          researchResults: [], // Empty results for general queries
          conversationContext: conversationContext,
          userProfile: userProfile,
          streamingMode: false,
          messageId: messageId,
          threadId: threadId
        }
      });

      if (generalResponse.error) {
        throw new Error(`General response generation failed: ${generalResponse.error.message}`);
      }

      return new Response(JSON.stringify({
        response: generalResponse.data.response,
        userStatusMessage: generalResponse.data.userStatusMessage,
        metadata: {
          classification: classification,
          strategy: 'general_response',
          userTimezone: userTimezone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
