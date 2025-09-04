
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

    // Parse request body
    const body = await req.json();
    const { 
      message, 
      userId, 
      threadId = null, 
      messageId = null,
      conversationContext = [],
      userProfile = {},
      requestId,
      category,
      userTimezone = 'UTC'
    } = body;
    
    console.log(`[chat-with-rag] Processing message for user with ${userProfile?.journalEntryCount || 0} journal entries`);

    // Use only approved user profile fields (no additional fetching from database)
    let completeUserProfile = {
      id: userProfile?.id || userId,
      fullName: userProfile?.fullName || null,
      displayName: userProfile?.displayName || null,
      timezone: userProfile?.timezone || userTimezone,
      country: userProfile?.country || 'DEFAULT',
      journalEntryCount: userProfile?.journalEntryCount || 0,
      reminderSettings: userProfile?.reminderSettings || {},
      notificationPreferences: userProfile?.notificationPreferences || {},
      createdAt: userProfile?.createdAt || new Date().toISOString()
    };
    
    console.log(`[chat-with-rag] Using approved profile fields only: entryCount=${completeUserProfile.journalEntryCount}, timezone=${completeUserProfile.timezone}, country=${completeUserProfile.country}`);

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${userId} (threadId: ${threadId}, messageId: ${messageId})`);
    
    // Generate correlation ID for this request
    const requestCorrelationId = crypto.randomUUID();
    const orchestratorId = `orchestrator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orchestratorStartTime = Date.now();
    
    console.log(`[ORCHESTRATOR START] ${orchestratorId}: RAG pipeline starting at ${new Date().toISOString()}`);
    console.log(`[ORCHESTRATOR] ${orchestratorId}: Generated correlation ID: ${requestCorrelationId}`);
    
    // Update user message with correlation ID to track RAG pipeline execution
    if (messageId) {
      try {
        await supabaseClient
          .from('chat_messages')
          .update({ request_correlation_id: requestCorrelationId })
          .eq('id', messageId);
        console.log(`[chat-with-rag] Updated user message ${messageId} with correlation ID: ${requestCorrelationId}`);
      } catch (updateError) {
        console.error('[chat-with-rag] Error updating user message with correlation ID:', updateError);
      }
    }
    
    // No processing message creation - handled by frontend streaming
    let assistantMessageId = null;
    
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
        body: { message, conversationContext, userProfile: completeUserProfile }
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

    // Create assistant message record after successful classification
    if (threadId) {
      try {
        console.log(`[chat-with-rag] Creating assistant message record for thread: ${threadId}`);
        
        const { data: newMessage, error: messageError } = await supabaseClient
          .from('chat_messages')
          .insert({
            thread_id: threadId,
            content: "Processing your request...",
            sender: 'assistant',
            role: 'assistant',
            is_processing: true,
            request_correlation_id: requestCorrelationId
          })
          .select('id')
          .single();

        if (messageError) {
          console.error('[chat-with-rag] Error creating assistant message:', messageError);
        } else {
          assistantMessageId = newMessage.id;
          console.log(`[chat-with-rag] Created assistant message with ID: ${assistantMessageId}`);
        }
      } catch (createError) {
        console.error('[chat-with-rag] Exception creating assistant message:', createError);
      }
    }

    if (classification.category === 'JOURNAL_SPECIFIC') {
      console.log("[chat-with-rag] EXECUTING: JOURNAL_SPECIFIC pipeline - full RAG processing");
      
      // Check if user has any journal entries first
      const { data: journalCount, error: countError } = await supabaseClient
        .from('Journal Entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      const hasJournalEntries = !countError && journalCount && journalCount.length > 0;
      console.log(`[chat-with-rag] User has ${hasJournalEntries ? journalCount.length : 0} journal entries`);
      
      if (!hasJournalEntries) {
        console.log("[chat-with-rag] No journal entries found - routing to general mental health chat");
        // Route to general mental health function which will intelligently handle journal prompting
        classification.category = 'GENERAL_MENTAL_HEALTH';
      } else {
        
        // Step 2: Enhanced Query Planning with timezone support
        const plannerStartTime = Date.now();
        console.log(`[ORCHESTRATOR] ${orchestratorId}: Calling smart-query-planner at ${new Date().toISOString()}`);
        
        const queryPlanResponse = await supabaseClient.functions.invoke('smart-query-planner', {
          body: { 
            message, 
            userId, 
            conversationContext,
            threadId,
            messageId,
            userProfile: completeUserProfile // Pass complete user profile including country
          }
        });

        const plannerTime = Date.now() - plannerStartTime;
        console.log(`[ORCHESTRATOR] ${orchestratorId}: smart-query-planner completed in ${plannerTime}ms`);

        if (queryPlanResponse.error) {
          console.error(`[ORCHESTRATOR ERROR] ${orchestratorId}: Query planning failed:`, queryPlanResponse.error);
          throw new Error(`Query planning failed: ${queryPlanResponse.error.message}`);
        }

        const queryPlan = queryPlanResponse.data.queryPlan;
        const executionResult = queryPlanResponse.data.executionResult;
        
        console.log(`[ORCHESTRATOR] ${orchestratorId}: Query plan completed - strategy: ${queryPlan.strategy}, results: ${executionResult?.length || 0}`);
        console.log(`[ORCHESTRATOR] ${orchestratorId}: Execution result summary:`, {
          resultCount: executionResult?.length || 0,
          hasResults: !!executionResult && executionResult.length > 0,
          correlationId: queryPlanResponse.data.correlationId
        });


      // Step 3: Generate consolidated response using gpt-response-consolidator
      const consolidatorStartTime = Date.now();
      console.log(`[ORCHESTRATOR] ${orchestratorId}: Calling gpt-response-consolidator at ${new Date().toISOString()}`);
      console.log(`[ORCHESTRATOR] ${orchestratorId}: Execution result structure for consolidator:`, {
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
          userProfile: { ...completeUserProfile, timezone: normalizedTimezone },
          streamingMode: false,
          messageId: assistantMessageId, // Use the assistant message ID we created
          threadId: threadId,
          userTimezone: normalizedTimezone
        }
      });

      const consolidatorTime = Date.now() - consolidatorStartTime;
      console.log(`[ORCHESTRATOR] ${orchestratorId}: gpt-response-consolidator completed in ${consolidatorTime}ms`);

      if (consolidationResponse.error) {
        console.error(`[ORCHESTRATOR ERROR] ${orchestratorId}: Consolidation failed:`, consolidationResponse.error);
        throw new Error(`Response consolidation failed: ${consolidationResponse.error.message}`);
      }

      const totalTime = Date.now() - orchestratorStartTime;
      console.log(`[ORCHESTRATOR SUCCESS] ${orchestratorId}: RAG pipeline completed in ${totalTime}ms (planner: ${plannerTime}ms, consolidator: ${consolidatorTime}ms)`);

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

      // Update the assistant message with the final response and analysis data
      if (assistantMessageId && finalResponse) {
        try {
          const updateData = {
            content: finalResponse,
            is_processing: false,
            // Store analysis data from consolidator if available
            analysis_data: consolidationResponse.data?.analysisMetadata || null,
            // Store sub-query responses if available in execution results
            sub_query_responses: executionResult || null,
            // Store reference entries if available
            reference_entries: consolidationResponse.data?.referenceEntries || null
          };

          await supabaseClient
            .from('chat_messages')
            .update(updateData)
            .eq('id', assistantMessageId);
          
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with response and analysis data:`, {
            hasAnalysisData: !!updateData.analysis_data,
            hasSubQueryResponses: !!updateData.sub_query_responses,
            hasReferenceEntries: !!updateData.reference_entries,
            responseLength: finalResponse?.length || 0
          });
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
          userTimezone: userTimezone,
          strategy: queryPlan.strategy,
          confidence: queryPlan.confidence,
          analysisMetadata: consolidationResponse.data.analysisMetadata
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
      } // End of else block for hasJournalEntries

    } else if (classification.category === 'GENERAL_MENTAL_HEALTH') {
      // Handle general mental health queries using dedicated function
      console.log(`[chat-with-rag] EXECUTING: GENERAL_MENTAL_HEALTH pipeline - general mental health chat`);
      
      const generalResponse = await supabaseClient.functions.invoke('general-mental-health-chat', {
        body: {
          message: message,
          conversationContext: conversationContext,
          userProfile: completeUserProfile  // Pass complete user profile including country
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
              content: generalResponse.data.response,
              is_processing: false
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with mental health response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
        }
      }

      // Extract the actual response text from the nested response object
      const responseText = generalResponse.data.response || generalResponse.data;
      console.log(`[chat-with-rag] Extracted response text: ${typeof responseText === 'string' ? responseText.substring(0, 100) : 'Not a string'}`);

      return new Response(JSON.stringify({
        response: responseText,
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
      const clarificationStartTime = Date.now();
      console.log(`[ORCHESTRATOR] ${orchestratorId}: EXECUTING CLARIFICATION pipeline - calling gpt-clarification-generator at ${new Date().toISOString()}`);
      
      const clarificationResponse = await supabaseClient.functions.invoke('gpt-clarification-generator', {
        body: {
          userMessage: message,
          conversationContext: conversationContext,
          userProfile: completeUserProfile
        }
      });

      const clarificationTime = Date.now() - clarificationStartTime;
      console.log(`[ORCHESTRATOR] ${orchestratorId}: gpt-clarification-generator completed in ${clarificationTime}ms`);

      if (clarificationResponse.error) {
        console.error(`[ORCHESTRATOR ERROR] ${orchestratorId}: Clarification failed:`, clarificationResponse.error);
        throw new Error(`Clarification generation failed: ${clarificationResponse.error.message}`);
      }

      // Extract the actual response text for clarification
      const clarificationText = clarificationResponse.data.response || clarificationResponse.data;
      console.log(`[chat-with-rag] Extracted clarification text: ${typeof clarificationText === 'string' ? clarificationText.substring(0, 100) : 'Not a string'}`);

      // Update the assistant message with the clarification response
      if (assistantMessageId && clarificationText) {
        try {
          await supabaseClient
            .from('chat_messages')
            .update({
              content: clarificationText,
              is_processing: false
            })
            .eq('id', assistantMessageId);
          console.log(`[chat-with-rag] Updated assistant message ${assistantMessageId} with clarification response`);
        } catch (updateError) {
          console.error('[chat-with-rag] Error updating assistant message:', updateError);
        }
      }

      return new Response(JSON.stringify({
        response: clarificationText,
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
              content: fallbackResponse,
              is_processing: false
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
    const totalTime = Date.now() - (orchestratorStartTime || Date.now());
    console.error(`[ORCHESTRATOR FAILURE] ${orchestratorId || 'unknown'}: Pipeline failed after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({
      error: 'Failed to process query with RAG pipeline',
      details: error.message,
      correlationId: orchestratorId,
      functionName: 'chat-with-rag',
      executionTimeMs: totalTime,
      fallbackResponse: "I apologize, but I'm having trouble processing your request right now. Please try rephrasing your question or try again later."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
