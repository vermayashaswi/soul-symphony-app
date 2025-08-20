
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

// Import the saveMessage function for consistent message persistence
const saveMessage = async (threadId: string, content: string, sender: 'user' | 'assistant', userId?: string, additionalData = {}) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const messageData = {
      thread_id: threadId,
      sender,
      role: sender,
      content,
      created_at: new Date().toISOString(),
      ...additionalData
    };

    const { data, error } = await supabaseClient
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('[saveMessage] Error saving message:', error);
      return null;
    }

    console.log(`[saveMessage] Successfully saved ${sender} message:`, data.id);
    return data;
  } catch (error) {
    console.error('[saveMessage] Exception:', error);
    return null;
  }
};

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
      correlationId = null
    } = await req.json();

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${userId} (threadId: ${threadId}, messageId: ${messageId}, correlationId: ${correlationId})`);
    
    // Enhanced thread validation before processing
    if (threadId) {
      const { data: threadValidation, error: threadError } = await supabaseClient
        .from('chat_threads')
        .select('id, user_id')
        .eq('id', threadId)
        .eq('user_id', userId)
        .single();
        
      if (threadError || !threadValidation) {
        console.error('[chat-with-rag] Thread validation failed:', threadError);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid thread context',
            correlationId: correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }
    
    // Create assistant message with enhanced idempotency
    let assistantMessageId = null;
    if (threadId) {
      try {
        console.log(`[chat-with-rag] Creating assistant message for thread: ${threadId}`);
        
        // Generate idempotency key for assistant message
        const assistantIdempotencyKey = correlationId ? 
          `assistant-${threadId}-${correlationId}` : 
          `assistant-${threadId}-${Date.now()}`;
        
        const { data: assistantMessage, error: messageError } = await supabaseClient
          .from('chat_messages')
          .upsert({
            thread_id: threadId,
            sender: 'assistant',
            role: 'assistant',
            content: 'Processing your journal query...',
            idempotency_key: assistantIdempotencyKey
          }, { onConflict: 'thread_id,idempotency_key' })
          .select('id')
          .single();
          
        if (messageError) {
          console.error('[chat-with-rag] Error creating assistant message:', messageError);
        } else {
          assistantMessageId = assistantMessage?.id;
          console.log(`[chat-with-rag] Created assistant message: ${assistantMessageId}`);
        }
      } catch (error) {
        console.error('[chat-with-rag] Exception creating assistant message:', error);
      }
    }
    
    // Enhanced timezone handling with validation
    const { normalizeUserTimezone } = await import('../_shared/timezoneUtils.ts');
    const { safeTimezoneConversion, debugTimezoneInfo } = await import('../_shared/enhancedTimezoneUtils.ts');
    
    const userTimezone = normalizeUserTimezone(userProfile);
    
    // Validate timezone and log detailed info for debugging
    const timezoneDebug = debugTimezoneInfo(userTimezone, 'chat-with-rag');
    console.log(`[chat-with-rag] User timezone validation:`, {
      userTimezone,
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
      
    // Step 2: Enhanced Query Planning with comprehensive error handling
      console.log("[chat-with-rag] Step 2: Calling smart-query-planner");
      
      let queryPlanResponse = null;
      let queryPlan = null;
      let executionResult = null;
      
      const maxPlannerRetries = 2;
      for (let attempt = 1; attempt <= maxPlannerRetries; attempt++) {
        console.log(`[chat-with-rag] Query planning attempt ${attempt}/${maxPlannerRetries}`);
        
        queryPlanResponse = await supabaseClient.functions.invoke('smart-query-planner', {
          body: { 
            message, 
            userId, 
            conversationContext,
            threadId,
            messageId,
            userTimezone, // Pass user timezone to planner
            execute: true, // Ensure execution happens
            isFollowUp: conversationContext.length > 0
          }
        });

        if (!queryPlanResponse.error && queryPlanResponse.data) {
          queryPlan = queryPlanResponse.data.queryPlan;
          executionResult = queryPlanResponse.data.executionResult;
          
          console.log(`[chat-with-rag] Query plan strategy: ${queryPlan?.strategy}, complexity: ${queryPlan?.queryComplexity || 'undefined'}`);
          console.log(`[chat-with-rag] Execution result summary:`, {
            resultCount: executionResult?.length || 0,
            hasResults: !!executionResult && executionResult.length > 0
          });
          
          // Check if we actually got meaningful results
          if (executionResult && executionResult.length > 0) {
            console.log(`[chat-with-rag] Query planning succeeded with ${executionResult.length} results`);
            break;
          } else if (attempt === maxPlannerRetries) {
            console.warn(`[chat-with-rag] Query planning returned no results after ${maxPlannerRetries} attempts`);
          }
        } else {
          console.error(`[chat-with-rag] Query planning attempt ${attempt} failed:`, queryPlanResponse.error);
          
          if (attempt === maxPlannerRetries) {
            // Final fallback: create a minimal execution result
            console.log(`[chat-with-rag] All query planning attempts failed, creating fallback execution result`);
            executionResult = [];
            queryPlan = {
              strategy: "fallback_strategy",
              queryComplexity: "simple",
              confidence: 0.5,
              reasoning: `Fallback plan due to query planning failures: ${queryPlanResponse.error?.message || 'Unknown error'}`
            };
          } else {
            // Wait before retry
            const delay = attempt * 1000; // 1s, 2s
            console.log(`[chat-with-rag] Retrying query planning in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

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
      
      let consolidationResponse = null;
      const maxConsolidationRetries = 2;
      
      for (let attempt = 1; attempt <= maxConsolidationRetries; attempt++) {
        console.log(`[chat-with-rag] Consolidation attempt ${attempt}/${maxConsolidationRetries}`);
        
        consolidationResponse = await supabaseClient.functions.invoke('gpt-response-consolidator', {
          body: {
            userMessage: message,
            researchResults: executionResult || [], // Map executionResult to researchResults
            conversationContext: conversationContext,
            userProfile: userProfile,
            streamingMode: false,
            messageId: assistantMessageId, // Use the assistant message ID we created
            threadId: threadId,
            queryPlan: queryPlan // Pass query plan for better context
          }
        });

        if (!consolidationResponse.error && consolidationResponse.data) {
          console.log("[chat-with-rag] Successfully completed RAG pipeline with consolidation");
          break;
        } else {
          console.error(`[chat-with-rag] Consolidation attempt ${attempt} failed:`, consolidationResponse.error);
          
          if (attempt === maxConsolidationRetries) {
            // Create a fallback response if consolidation completely fails
            console.log("[chat-with-rag] All consolidation attempts failed, creating fallback response");
            consolidationResponse = {
              data: {
                response: `I apologize, but I'm having trouble processing your request right now. Let me try to help you with what I understand from your query: "${message}". Could you try rephrasing your question, or let me know if you'd like to explore a specific aspect of your journaling patterns?`,
                userStatusMessage: "System recovery in progress",
                analysisMetadata: {
                  fallbackUsed: true,
                  originalError: consolidationResponse.error?.message || "Unknown consolidation error"
                }
              }
            };
          } else {
            // Wait before retry
            const delay = attempt * 1000;
            console.log(`[chat-with-rag] Retrying consolidation in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Save the final response using saveMessage for consistency
      if (threadId && userId && consolidationResponse.data.response) {
        try {
          const idempotencyKey = correlationId ? 
            `rag-response-${threadId}-${correlationId}` : 
            `rag-response-${threadId}-${Date.now()}`;

          const analysisData = {
            classification: classification,
            queryPlan: queryPlan,
            executionSummary: {
              resultCount: executionResult?.length || 0,
              strategy: queryPlan?.strategy || 'unknown',
              confidence: queryPlan?.confidence || 0
            },
            timestamp: new Date().toISOString(),
            modelUsed: 'gpt-4.1-nano-2025-04-14',
            processingSuccess: true,
            correlationId: correlationId
          };

          const savedMessage = await saveMessage(
            threadId,
            consolidationResponse.data.response,
            'assistant',
            userId,
            {
              analysis_data: analysisData,
              idempotency_key: idempotencyKey,
              references: executionResult || [],
              is_interactive: false
            }
          );

          if (savedMessage) {
            console.log(`[chat-with-rag] Successfully saved RAG response: ${savedMessage.id}`);
          }
        } catch (error) {
          console.error('[chat-with-rag] Error saving response:', error);
        }
      }
        } catch (updateError) {
          console.error('[chat-with-rag] Exception updating assistant message:', updateError);
        }
      }

      return new Response(JSON.stringify({
        response: consolidationResponse.data.response,
        userStatusMessage: consolidationResponse.data.userStatusMessage,
        assistantMessageId: assistantMessageId,
        correlationId: correlationId, // Return correlation ID for request tracking
        metadata: {
          classification: classification,
          queryPlan: queryPlan,
          searchResults: executionResult,
          timeRange: timeRange,
          userTimezone: userTimezone,
          strategy: queryPlan.strategy,
          confidence: queryPlan.confidence,
          analysisMetadata: consolidationResponse.data.analysisMetadata,
          threadValidation: true
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
              content: generalResponse.data
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
