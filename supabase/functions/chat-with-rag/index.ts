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
    
    // Clean approach - let final response create the assistant message
    let assistantMessageId = null;
    
    // Simple timezone handling with fallback
    const userTimezone = userProfile?.timezone || 'UTC';
    console.log(`[chat-with-rag] Using user timezone: ${userTimezone}`);

    // Step 1: Query Classification with retry logic
    console.log("[chat-with-rag] Step 1: Query Classification");
    
    const maxRetries = 3;
    let classification = null;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[chat-with-rag] Classification attempt ${attempt}/${maxRetries}`);
      
      const classificationResponse = await supabaseClient.functions.invoke('chat-query-classifier', {
        body: { message, conversationContext }
      });
      
      if (!classificationResponse.error && classificationResponse.data) {
        classification = classificationResponse.data;
        break;
      }
      
      lastError = classificationResponse.error;
      console.error(`[chat-with-rag] Classification attempt ${attempt} failed:`, lastError);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`[chat-with-rag] Retrying classification in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!classification) {
      console.error("[chat-with-rag] All classification attempts failed. Last error:", lastError);
      return new Response(
        JSON.stringify({ 
          error: 'Classification service unavailable. Please try again.',
          details: lastError
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
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
      const userStatusMessageFromPlanner = queryPlanResponse.data.userStatusMessage;
      
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
          messageId: assistantMessageId, // Use the assistant message ID we created
          threadId: threadId
        }
      });

      if (consolidationResponse.error) {
        console.error("[chat-with-rag] Consolidation error:", consolidationResponse.error);
        throw new Error(`Response consolidation failed: ${consolidationResponse.error.message}`);
      }

      console.log("[chat-with-rag] Successfully completed RAG pipeline with consolidation");

      // Create assistant message with the final response content directly
      if (threadId && consolidationResponse.data) {
        try {
          console.log('[chat-with-rag] Creating assistant message with final response');
          
          let finalResponseContent = consolidationResponse.data.response;
          
          // Validate that the content is actually a readable string
          if (!finalResponseContent || typeof finalResponseContent !== 'string') {
            console.error('[chat-with-rag] ERROR: Invalid response content:', typeof finalResponseContent);
            finalResponseContent = "I processed your request but encountered an issue with the response format. Please try again.";
          }
          
          const { data: messageData, error: messageError } = await supabaseClient
            .from('chat_messages')
            .insert({
              thread_id: threadId,
              sender: 'assistant',
              role: 'assistant',
              content: finalResponseContent,
              analysis_data: consolidationResponse.data.analysisMetadata || null
            })
            .select('id')
            .single();
          
          if (messageError) {
            console.error('[chat-with-rag] Error creating assistant message:', messageError);
          } else {
            assistantMessageId = messageData.id;
            console.log(`[chat-with-rag] Created assistant message ${assistantMessageId} with response (${finalResponseContent.length} chars)`);
          }
        } catch (error) {
          console.error('[chat-with-rag] Exception creating assistant message:', error);
        }
      }

      return new Response(JSON.stringify({
        response: consolidationResponse.data.response,
        userStatusMessage: userStatusMessageFromPlanner || consolidationResponse.data.userStatusMessage,
        assistantMessageId: assistantMessageId, // Include the assistant message ID in response
        queryClassification: classification.category,
        queryComplexity: queryPlan?.complexity || 'standard',
        executionStrategy: queryPlan?.strategy || 'unknown',
        metadata: {
          classification: classification,
          queryPlan: queryPlan,
          searchResults: executionResult,
          timeRange: timeRange,
          userTimezone: userTimezone,
          strategy: queryPlan.strategy,
          confidence: queryPlan.confidence,
          analysisMetadata: consolidationResponse.data.analysisMetadata,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (classification.category === 'GENERAL_MENTAL_HEALTH') {
      // Handle general mental health queries using dedicated function
      console.log(`[chat-with-rag] EXECUTING: GENERAL_MENTAL_HEALTH pipeline - general mental health chat`);
      
      const generalResponse = await supabaseClient.functions.invoke('general-mental-health-chat', {
        body: {
          message: message,
          conversationContext: conversationContext,
          userTimezone: userTimezone  // Pass validated timezone
        }
      });

      if (generalResponse.error) {
        throw new Error(`General mental health response failed: ${generalResponse.error.message}`);
      }

      // Create assistant message with mental health response
      if (threadId && generalResponse.data) {
        try {
          const { data: messageData, error: messageError } = await supabaseClient
            .from('chat_messages')
            .insert({
              thread_id: threadId,
              sender: 'assistant',
              role: 'assistant',
              content: generalResponse.data
            })
            .select('id')
            .single();
          
          if (messageError) {
            console.error('[chat-with-rag] Error creating assistant message:', messageError);
          } else {
            assistantMessageId = messageData.id;
            console.log(`[chat-with-rag] Created assistant message ${assistantMessageId} with mental health response`);
          }
        } catch (error) {
          console.error('[chat-with-rag] Exception creating assistant message:', error);
        }
      }

      return new Response(JSON.stringify({
        response: generalResponse.data,
        assistantMessageId: assistantMessageId,
        metadata: {
          classification: classification,
          strategy: 'general_mental_health',
          userTimezone: userTimezone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (classification.category === 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION') {
      // Handle queries that need clarification
      console.log(`[chat-with-rag] EXECUTING: JOURNAL_SPECIFIC_NEEDS_CLARIFICATION pipeline - clarification request`);
      
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

      // Create assistant message with clarification response
      if (threadId && clarificationResponse.data.response) {
        try {
          const { data: messageData, error: messageError } = await supabaseClient
            .from('chat_messages')
            .insert({
              thread_id: threadId,
              sender: 'assistant',
              role: 'assistant',
              content: clarificationResponse.data.response
            })
            .select('id')
            .single();
          
          if (messageError) {
            console.error('[chat-with-rag] Error creating assistant message:', messageError);
          } else {
            assistantMessageId = messageData.id;
            console.log(`[chat-with-rag] Created assistant message ${assistantMessageId} with clarification response`);
          }
        } catch (error) {
          console.error('[chat-with-rag] Exception creating assistant message:', error);
        }
      }

      return new Response(JSON.stringify({
        response: clarificationResponse.data.response,
        assistantMessageId: assistantMessageId,
        needsClarification: true,
        clarificationQuestions: clarificationResponse.data.clarificationQuestions,
        metadata: {
          classification: classification,
          strategy: 'clarification_needed',
          clarificationReason: clarificationResponse.data.clarificationReason,
          userTimezone: userTimezone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Fallback to general mental health for unclassified queries
      console.log(`[chat-with-rag] FALLBACK: Unrecognized category '${classification.category}' - using general mental health`);
      
      const fallbackResponse = await supabaseClient.functions.invoke('general-mental-health-chat', {
        body: {
          message: message,
          conversationContext: conversationContext,
          userTimezone: userTimezone
        }
      });

      if (fallbackResponse.error) {
        throw new Error(`Fallback response failed: ${fallbackResponse.error.message}`);
      }

      // Create assistant message with fallback response
      if (threadId && fallbackResponse.data) {
        try {
          const { data: messageData, error: messageError } = await supabaseClient
            .from('chat_messages')
            .insert({
              thread_id: threadId,
              sender: 'assistant',
              role: 'assistant',
              content: fallbackResponse.data
            })
            .select('id')
            .single();
          
          if (messageError) {
            console.error('[chat-with-rag] Error creating assistant message:', messageError);
          } else {
            assistantMessageId = messageData.id;
            console.log(`[chat-with-rag] Created assistant message ${assistantMessageId} with fallback response`);
          }
        } catch (error) {
          console.error('[chat-with-rag] Exception creating assistant message:', error);
        }
      }

      return new Response(JSON.stringify({
        response: fallbackResponse.data,
        assistantMessageId: assistantMessageId,
        metadata: {
          classification: classification,
          strategy: 'fallback_general',
          userTimezone: userTimezone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error("[chat-with-rag] Error in enhanced RAG processing:", error);
    
    return new Response(JSON.stringify({
      error: "Failed to process your message. Please try again.",
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});