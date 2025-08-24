
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
      userProfile = null,
      userTimezone = 'UTC'
    } = await req.json();

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${userId} (threadId: ${threadId}, messageId: ${messageId})`);
    
    // No processing message creation - handled by frontend streaming
    let assistantMessageId = null;
          console.log(`[chat-with-rag] Created assistant message: ${assistantMessageId}`);
        }
      } catch (error) {
        console.error('[chat-with-rag] Exception creating assistant message:', error);
      }
    }
    
    // Enhanced timezone handling with validation
    const { normalizeTimezone } = await import('../_shared/timezoneUtils.ts');
    const { safeTimezoneConversion, debugTimezoneInfo } = await import('../_shared/enhancedTimezoneUtils.ts');
    
    const normalizedTimezone = normalizeTimezone(userTimezone);
    
    // Validate timezone and log detailed info for debugging
    const timezoneDebug = debugTimezoneInfo(normalizedTimezone, 'chat-with-rag');
    console.log(`[chat-with-rag] User timezone validation:`, {
      userTimezone: normalizedTimezone,
      isValid: timezoneDebug.validation.isValid,
      issues: timezoneDebug.validation.issues
    });

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
      
      console.log(`[chat-with-rag] Query plan strategy: ${queryPlan.strategy}, complexity: ${queryPlan.queryComplexity}`);
      console.log(`[chat-with-rag] Execution result summary:`, {
        resultCount: executionResult?.length || 0,
        hasResults: !!executionResult && executionResult.length > 0
      });

      // Enhanced timeframe detection with timezone support
      let timeRange = null;
      const detectedTimeframe = detectTimeframeInQuery(message, normalizedTimezone);
      
      if (detectedTimeframe) {
        console.log(`[chat-with-rag] Detected timeframe with timezone ${normalizedTimezone}:`, JSON.stringify(detectedTimeframe, null, 2));
        // Process timeframe with user's timezone for proper UTC conversion
        timeRange = processTimeRange(detectedTimeframe, normalizedTimezone);
        console.log(`[chat-with-rag] Processed time range (converted to UTC):`, JSON.stringify(timeRange, null, 2));
      }

      // Step 3: Generate consolidated response using gpt-response-consolidator
      console.log("[chat-with-rag] Step 3: Calling gpt-response-consolidator");
      console.log("[chat-with-rag] Execution result structure for consolidator:", {
        hasExecutionResult: !!executionResult,
        executionResultLength: executionResult?.length || 0,
        sampleResult: executionResult?.[0] ? {
          hasExecutionSummary: !!executionResult[0].executionSummary,
          summaryType: executionResult[0].executionSummary?.resultType,
          summaryData: executionResult[0].executionSummary?.summary
        } : null
      });
      
      const consolidationResponse = await supabaseClient.functions.invoke('gpt-response-consolidator', {
        body: {
          userMessage: message,
          researchResults: executionResult || [], // Processed results from smart query planner
          conversationContext: conversationContext,
          userProfile: { ...userProfile, timezone: normalizedTimezone },
          streamingMode: false,
          messageId: assistantMessageId, // Use the assistant message ID we created
          threadId: threadId,
          userTimezone: normalizedTimezone
        }
      });

      if (consolidationResponse.error) {
        console.error("[chat-with-rag] Consolidation error:", consolidationResponse.error);
        throw new Error(`Response consolidation failed: ${consolidationResponse.error.message}`);
      }

      console.log("[chat-with-rag] Successfully completed RAG pipeline with consolidation");

      // Parse consolidation response properly
      let finalResponse;
      let userStatusMessage;
      
      console.log("[chat-with-rag] Consolidation response structure:", {
        hasData: !!consolidationResponse.data,
        dataKeys: consolidationResponse.data ? Object.keys(consolidationResponse.data) : [],
        dataType: typeof consolidationResponse.data
      });

      // Extract response from consolidation data
      if (consolidationResponse.data) {
        if (typeof consolidationResponse.data === 'string') {
          // If data is a string, try to parse it as JSON
          try {
            const parsedData = JSON.parse(consolidationResponse.data);
            finalResponse = parsedData.response || consolidationResponse.data;
            userStatusMessage = parsedData.userStatusMessage;
          } catch {
            // If parsing fails, use the string directly
            finalResponse = consolidationResponse.data;
            userStatusMessage = null;
          }
        } else if (consolidationResponse.data.response) {
          // If data is an object with response field
          finalResponse = consolidationResponse.data.response;
          userStatusMessage = consolidationResponse.data.userStatusMessage;
        } else {
          // Fallback to the entire data object as string
          finalResponse = JSON.stringify(consolidationResponse.data);
          userStatusMessage = null;
        }
      } else {
        finalResponse = "I apologize, but I encountered an issue processing your request.";
        userStatusMessage = null;
      }

      console.log("[chat-with-rag] Extracted response:", {
        responseLength: finalResponse?.length || 0,
        hasStatusMessage: !!userStatusMessage
      });

      // Update the assistant message with the final response
      if (assistantMessageId && finalResponse) {
        try {
          await supabaseClient
            .from('chat_messages')
            .update({
              content: finalResponse
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
        }
      }

      return new Response(JSON.stringify({
        response: finalResponse,
        userStatusMessage: userStatusMessage,
        assistantMessageId: assistantMessageId, // Include the assistant message ID in response
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

      // Update the assistant message with the mental health response
      if (assistantMessageId && generalResponse.data) {
        try {
          await supabaseClient
            .from('chat_messages')
            .update({
              content: generalResponse.data.response
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with mental health response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
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

      // Update the assistant message with the clarification response
      if (assistantMessageId && clarificationResponse.data.response) {
        try {
          await supabaseClient
            .from('chat_messages')
            .update({
              content: clarificationResponse.data.response
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with clarification response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
        }
      }

      return new Response(JSON.stringify({
        response: clarificationResponse.data.response,
        userStatusMessage: clarificationResponse.data.userStatusMessage,
        assistantMessageId: assistantMessageId,
        metadata: {
          classification: classification,
          strategy: 'clarification',
          type: clarificationResponse.data.type,
          userTimezone: userTimezone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (classification.category === 'UNRELATED') {
      // Handle unrelated queries with witty rejection messages
      console.log(`[chat-with-rag] EXECUTING: UNRELATED pipeline - witty rejection`);
      
      // Array of witty rejection responses
      const unrelatedResponses = [
        "Haha, you caught me! I'm basically a one-trick pony, but it's a really GOOD trick! 🐴✨ Think of me as your personal feelings detective, journal whisperer, and emotional GPS all rolled into one. I can't help with that question, but I'd love to hear what's been stirring in your world today! 🌍💫",
        "Whoops! Looks like you've found the edge of my brain! 🤯 I'm like that friend who's AMAZING at deep 2am conversations about life but terrible at trivia night. I live for your thoughts, feelings, journal entries, and all things emotional wellbeing - that's where I absolutely shine! ✨ What's your heart been up to lately? 💛",
        "Oops! You just wandered into my 'does not compute' zone! 🤖💫 I'm basically a specialist who speaks fluent emotion and journal-ese, but that question is outside my wheelhouse. How about we dive into something I'm actually brilliant at - like exploring what's been on your mind recently? 🧠✨",
        "Plot twist! You stumbled upon the one thing I can't chat about! 😄 I'm like a really passionate therapist friend who only knows how to talk about feelings, patterns, and personal growth. But hey, that's not so bad, right? What's been weighing on your heart lately? 💭💙"
      ];
      
      // Randomly select a response
      const selectedResponse = unrelatedResponses[Math.floor(Math.random() * unrelatedResponses.length)];
      
      // Update the assistant message with the rejection response
      if (assistantMessageId) {
        try {
          await supabaseClient
            .from('chat_messages')
            .update({
              content: selectedResponse
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with unrelated response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
        }
      }

      return new Response(JSON.stringify({
        response: selectedResponse,
        userStatusMessage: "Politely redirecting with humor",
        assistantMessageId: assistantMessageId,
        metadata: {
          classification: classification,
          strategy: 'unrelated_rejection',
          userTimezone: userTimezone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Handle unexpected classification categories with fallback
      console.log(`[chat-with-rag] UNKNOWN CLASSIFICATION: ${classification.category} - using fallback response`);
      
      const fallbackResponse = "I'm having trouble understanding your request right now. Could you try rephrasing it? I'm here to help with your journal insights and emotional wellbeing! 💙";
      
      // Update the assistant message with fallback response
      if (assistantMessageId) {
        try {
          await supabaseClient
            .from('chat_messages')
            .update({
              content: fallbackResponse
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with fallback response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
        }
      }

      return new Response(JSON.stringify({
        response: fallbackResponse,
        userStatusMessage: "Handling unknown request type",
        assistantMessageId: assistantMessageId,
        metadata: {
          classification: classification,
          strategy: 'fallback_response',
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
