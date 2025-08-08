import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { createStreamingResponse, SSEStreamManager } from './utils/streamingResponseManager.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[chat-with-rag] Starting enhanced RAG processing with classification');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestBody = await req.json();
    const { 
      message, 
      userId: requestUserId, 
      conversationContext = [], 
      userProfile = {},
      threadId,
      messageId
    } = requestBody;

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${requestUserId} (threadId: ${threadId || 'none'}, messageId: ${messageId || 'none'})`);

    // Check if streaming is enabled
    const enableStreaming = requestBody.streamingMode || false;
    
    // Create a classification cache key to ensure consistency
    const classificationCacheKey = `${message}_${JSON.stringify(conversationContext.slice(-2))}`;
    let cachedClassification = null;
    
    if (enableStreaming) {
      // Create streaming response
      const { response, controller } = createStreamingResponse();
      const streamManager = new SSEStreamManager(controller);
      
      // Start pipeline with streaming status updates
      processStreamingPipeline(streamManager, requestBody, supabaseClient, openaiApiKey).catch(error => {
        console.error('[chat-with-rag] Streaming pipeline error:', error);
        streamManager.sendEvent('error', { error: error.message });
        streamManager.close();
      });
      
      return response;
    }

    // Step 1: Classify the query to determine processing approach (single invocation)
    console.log('[chat-with-rag] Step 1: Query Classification');
    const { data: classification, error: classificationError } = await supabaseClient.functions.invoke(
      'chat-query-classifier',
      {
        body: { message, conversationContext, threadId, messageId }
      }
    );

    if (classificationError) {
      throw new Error(`Query classification failed: ${classificationError.message}`);
    }

    // Validate classification result structure
    if (!classification || !classification.category) {
      throw new Error('Invalid classification result - missing category');
    }

    console.log(`[chat-with-rag] Query classified as: ${classification.category} (confidence: ${classification.confidence})`);
    
    // Heuristic override for obvious journal-specific queries
    const lowerMsg = (message || '').toLowerCase();
    const personalLikely = /\b(i|me|my|mine|myself)\b/i.test(lowerMsg);
    const temporalLikely = /\b(last week|last month|this week|this month|today|yesterday|recently|lately)\b/i.test(lowerMsg);
    const journalHints = /\b(journal|entry|entries|log|logged)\b/i.test(lowerMsg);
    if (classification.category === 'GENERAL_MENTAL_HEALTH' && ((personalLikely && temporalLikely) || journalHints)) {
      console.warn('[chat-with-rag] OVERRIDE: Forcing JOURNAL_SPECIFIC due to personal+temporal/journal hints');
      classification.category = 'JOURNAL_SPECIFIC';
    }
    
    // Cache the classification to prevent inconsistencies
    cachedClassification = classification;
    // Handle unrelated queries with polite denial
    if (cachedClassification.category === 'UNRELATED') {
      console.log('[chat-with-rag] EXECUTING: UNRELATED pipeline - polite denial');
      return new Response(JSON.stringify({
        response: "I appreciate your question, but I'm specifically designed to help you explore your journal entries, understand your emotional patterns, and support your mental health and well-being. I focus on analyzing your personal reflections and providing insights about your journey. Is there something about your thoughts, feelings, or experiences you'd like to discuss instead?",
        userStatusMessage: null,
        analysis: {
          queryType: 'unrelated_denial',
          classification,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle clarification queries directly
    if (cachedClassification.category === 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION') {
      console.log('[chat-with-rag] EXECUTING: CLARIFICATION pipeline');
      const { data: clarificationResult, error: clarificationError } = await supabaseClient.functions.invoke(
        'gpt-clarification-generator',
        {
          body: { 
            userMessage: message,
            conversationContext,
            userProfile,
            threadId,
            messageId 
          }
        }
      );

      if (clarificationError) {
        throw new Error(`Clarification generation failed: ${clarificationError.message}`);
      }

      return new Response(JSON.stringify({
        response: clarificationResult.response,
        userStatusMessage: clarificationResult.userStatusMessage,
        analysis: {
          queryType: 'clarification',
          classification,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For JOURNAL_SPECIFIC queries, process through the full RAG pipeline
    if (cachedClassification.category === 'JOURNAL_SPECIFIC') {
      console.log('[chat-with-rag] EXECUTING: JOURNAL_SPECIFIC pipeline - full RAG processing');
      
      // Step 2: Use GPT-powered query planning via smart-query-planner
      let enhancedQueryPlan;
      
      try {
        const { data: gptPlan, error: plannerError } = await supabaseClient.functions.invoke(
          'smart-query-planner',
          {
            body: {
              message,
              userId: requestUserId,
              conversationContext,
              userProfile,
              timeRange: userProfile.timeRange || null,
              threadId,
              messageId
            }
          }
        );
        
        if (plannerError) {
          throw new Error(`GPT planner error: ${plannerError.message}`);
        }
        
        enhancedQueryPlan = gptPlan.queryPlan;
        console.log('[chat-with-rag] Using GPT-generated query plan:', enhancedQueryPlan);
      } catch (error) {
        console.error('[chat-with-rag] GPT planner failed:', error);
        throw new Error('Query planning failed');
      }
      
      console.log(`[chat-with-rag] Query plan strategy: ${enhancedQueryPlan.strategy}, complexity: ${enhancedQueryPlan.complexity}`);

      // Step 3: Check if we should use GPT-driven analysis (any sub-questions >= 1)
      const shouldUseGptAnalysis = enhancedQueryPlan.subQuestions && enhancedQueryPlan.subQuestions.length >= 1;
      
      if (shouldUseGptAnalysis) {
        console.log(`[chat-with-rag] Using GPT-driven analysis pipeline for ${enhancedQueryPlan.subQuestions.length} sub-questions`);
        
        // Normalize time range from plan (supports dateRange {startDate,endDate} or timeRange {start,end})
        const normalizedTimeRange = (() => {
          const tr = enhancedQueryPlan?.timeRange || enhancedQueryPlan?.dateRange || null;
          if (!tr) return null;
          const start = tr.start ?? tr.startDate ?? null;
          const end = tr.end ?? tr.endDate ?? null;
          return (start || end) ? { start, end } : null;
        })();
        
        // Step 4: Call GPT Analysis Orchestrator for sub-question analysis
        const { data: analysisResults, error: analysisError } = await supabaseClient.functions.invoke(
          'gpt-analysis-orchestrator',
          {
            body: {
              subQuestions: enhancedQueryPlan.subQuestions,
              userMessage: message,
              userId: requestUserId,
              timeRange: normalizedTimeRange,
              threadId,
              messageId
            }
          }
        );

        if (analysisError) {
          throw new Error(`Analysis orchestrator failed: ${analysisError.message}`);
        }

        // Step 5: Call GPT Response Consolidator to synthesize the results
        const { data: consolidationResult, error: consolidationError } = await supabaseClient.functions.invoke(
          'gpt-response-consolidator',
          {
            body: {
              userMessage: message,
              analysisResults: analysisResults.analysisResults,
              conversationContext,
              userProfile,
              streamingMode: false,
              threadId,
              messageId
            }
          }
        );

        if (consolidationError) {
          throw new Error(`Response consolidator failed: ${consolidationError.message}`);
        }

        console.log('[chat-with-rag] Successfully completed GPT-driven analysis pipeline');

        const finalResponse = (typeof consolidationResult?.response === 'string' && consolidationResult.response.trim())
          ? consolidationResult.response
          : "I couldn't synthesize a confident insight just now. Let's try again in a moment.";

        return new Response(JSON.stringify({
          response: finalResponse,
          userStatusMessage: consolidationResult.userStatusMessage,
          analysis: {
            queryPlan: enhancedQueryPlan,
            gptDrivenAnalysis: true,
            subQuestionAnalysis: analysisResults.summary,
            consolidationMetadata: consolidationResult.analysisMetadata,
            classification
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        throw new Error('No sub-questions generated - unable to process query');
      }
    }

    // For GENERAL_MENTAL_HEALTH category (including conversational responses)
    if (cachedClassification.category === 'GENERAL_MENTAL_HEALTH') {
      console.log('[chat-with-rag] EXECUTING: GENERAL_MENTAL_HEALTH pipeline');
      
      try {
        const { data: generalResponse, error: generalError } = await supabaseClient.functions.invoke(
          'general-mental-health-chat',
          {
            body: { message, conversationContext, threadId }
          }
        );

        if (generalError) {
          throw new Error(`General mental health chat failed: ${generalError.message}`);
        }

        const reply = (typeof generalResponse?.response === 'string' && generalResponse.response.trim())
          ? generalResponse.response
          : "I’m here to support your mental health journey. Could you share a bit more so I can respond meaningfully?";

        return new Response(JSON.stringify({
          response: reply,
          analysis: {
            queryType: 'general_mental_health',
            classification,
            timestamp: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        // Fallback response for general mental health queries
        console.error('[chat-with-rag] General mental health chat failed:', error);
        return new Response(JSON.stringify({
          response: "I understand you're reaching out. For questions about your personal journal insights, I'm here to help analyze your entries. For general wellness information, feel free to ask specific questions!",
          analysis: {
            queryType: 'general_fallback',
            classification,
            timestamp: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback for any other categories
    console.log(`[chat-with-rag] EXECUTING: UNKNOWN_CATEGORY pipeline for: ${cachedClassification.category}`);
    console.error(`[chat-with-rag] WARNING: Unhandled classification category: ${cachedClassification.category}`);
    return new Response(JSON.stringify({
      response: "I understand you're reaching out. For questions about your personal journal insights, I'm here to help analyze your entries. For general wellness information, feel free to ask specific questions!",
      analysis: {
        queryType: 'unknown_category',
        classification: cachedClassification,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in enhanced RAG:', error);

    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while processing your request. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'rag_pipeline_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Streaming pipeline function for real-time status updates
async function processStreamingPipeline(
  streamManager: SSEStreamManager, 
  requestBody: any, 
  supabaseClient: any, 
  openaiApiKey: string
) {
  try {
    const { 
      message, 
      userId: requestUserId, 
      conversationContext = [], 
      userProfile = {},
      threadId,
      messageId
    } = requestBody;

    // Step 1: Query classification with status updates (streaming mode)
    streamManager.sendUserMessage("Understanding your question");
    streamManager.sendBackendTask("query_classification", "Analyzing query type and requirements");
    
    const { data: classification, error: classificationError } = await supabaseClient.functions.invoke(
      'chat-query-classifier',
      {
        body: { message, conversationContext, threadId, messageId }
      }
    );
    
    if (classificationError) {
      throw new Error(`Query classification failed: ${classificationError.message}`);
    }

    // Validate classification result in streaming mode
    if (!classification || !classification.category) {
      throw new Error('Invalid classification result - missing category');
    }

    console.log(`[chat-with-rag] STREAMING: Query classified as: ${classification.category} (confidence: ${classification.confidence})`);

    // Heuristic override for obvious journal-specific queries (streaming)
    {
      const lowerMsg = (message || '').toLowerCase();
      const personalLikely = /\b(i|me|my|mine|myself)\b/i.test(lowerMsg);
      const temporalLikely = /\b(last week|last month|this week|this month|today|yesterday|recently|lately)\b/i.test(lowerMsg);
      const journalHints = /\b(journal|entry|entries|log|logged)\b/i.test(lowerMsg);
      if (classification.category === 'GENERAL_MENTAL_HEALTH' && ((personalLikely && temporalLikely) || journalHints)) {
        console.warn('[chat-with-rag] STREAMING OVERRIDE: Forcing JOURNAL_SPECIFIC due to personal+temporal/journal hints');
        classification.category = 'JOURNAL_SPECIFIC';
      }
    }

    // Handle unrelated queries in streaming mode
    if (classification.category === 'UNRELATED') {
      console.log('[chat-with-rag] STREAMING EXECUTING: UNRELATED pipeline');
      streamManager.sendUserMessage("Gently redirecting to wellness focus");
      
      streamManager.sendEvent('final_response', {
        response: "I appreciate your question, but I'm specifically designed to help you explore your journal entries, understand your emotional patterns, and support your mental health and well-being. I focus on analyzing your personal reflections and providing insights about your journey. Is there something about your thoughts, feelings, or experiences you'd like to discuss instead?",
        analysis: {
          queryType: 'unrelated_denial',
          classification,
          timestamp: new Date().toISOString()
        }
      });

      streamManager.close();
      return;
    }

    // Handle clarification queries in streaming mode
    if (classification.category === 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION') {
      console.log('[chat-with-rag] STREAMING EXECUTING: CLARIFICATION pipeline');
      streamManager.sendUserMessage("Creating space for deeper understanding");
      streamManager.sendBackendTask("clarification_generation", "Generating thoughtful questions");
      
      const { data: clarificationResult, error: clarificationError } = await supabaseClient.functions.invoke(
        'gpt-clarification-generator',
        {
          body: { 
            userMessage: message,
            conversationContext,
            userProfile,
            threadId,
            messageId 
          }
        }
      );

      if (clarificationError) {
        throw new Error(`Clarification generation failed: ${clarificationError.message}`);
      }

      if (clarificationResult.userStatusMessage) {
        streamManager.sendUserMessage(clarificationResult.userStatusMessage);
      }

      streamManager.sendEvent('final_response', {
        response: clarificationResult.response,
        analysis: {
          queryType: 'clarification',
          classification,
          timestamp: new Date().toISOString()
        }
      });

      streamManager.close();
      return;
    }

    // For JOURNAL_SPECIFIC, continue with full pipeline
    if (classification.category === 'JOURNAL_SPECIFIC') {
      console.log('[chat-with-rag] STREAMING EXECUTING: JOURNAL_SPECIFIC pipeline');
      // Step 2: Query planning with status updates
      streamManager.sendUserMessage("Breaking down your question carefully");
      streamManager.sendBackendTask("query_planning", "Analyzing query structure and requirements");
      
      const { data: gptPlan, error: plannerError } = await supabaseClient.functions.invoke(
      'smart-query-planner',
      {
        body: {
          message,
          userId: requestUserId,
          conversationContext,
          userProfile,
          timeRange: userProfile.timeRange || null,
          threadId,
          messageId
        }
      }
      );
      
      if (plannerError) {
        throw new Error(`GPT planner error: ${plannerError.message}`);
      }
      
      const enhancedQueryPlan = gptPlan.queryPlan;
      
      // Check for user status message from query planner
      if (gptPlan.userStatusMessage) {
        streamManager.sendUserMessage(gptPlan.userStatusMessage);
      }
      
      // Step 3: Analysis orchestration with status updates
      streamManager.sendBackendTask("Searching your journal...", "Looking through journal entries");
      
      // Normalize time range for orchestrator
      const normalizedTimeRange = (() => {
        const tr = enhancedQueryPlan?.timeRange || enhancedQueryPlan?.dateRange || null;
        if (!tr) return null;
        const start = tr.start ?? tr.startDate ?? null;
        const end = tr.end ?? tr.endDate ?? null;
        return (start || end) ? { start, end } : null;
      })();
      
      const { data: analysisResults, error: analysisError } = await supabaseClient.functions.invoke(
        'gpt-analysis-orchestrator',
        {
          body: {
            subQuestions: enhancedQueryPlan.subQuestions,
            userMessage: message,
            userId: requestUserId,
            timeRange: normalizedTimeRange,
            threadId
          }
        }
      );

      if (analysisError) {
        throw new Error(`Analysis orchestrator failed: ${analysisError.message}`);
      }

      streamManager.sendBackendTask("Journal analysis complete", "Processing insights");

      // Step 4: Response consolidation with status updates
      streamManager.sendBackendTask("Crafting your response...", "Generating personalized insights");
      
      const { data: consolidationResult, error: consolidationError } = await supabaseClient.functions.invoke(
        'gpt-response-consolidator',
        {
          body: {
            userMessage: message,
            analysisResults: analysisResults.analysisResults,
            conversationContext,
            userProfile,
            streamingMode: false,
            threadId
          }
        }
      );

      if (consolidationError) {
        throw new Error(`Response consolidator failed: ${consolidationError.message}`);
      }

      // Check for user status message from response consolidator
      if (consolidationResult.userStatusMessage) {
        streamManager.sendUserMessage(consolidationResult.userStatusMessage);
      }

      // Send final response
      streamManager.sendEvent('final_response', {
        response: consolidationResult.response,
        analysis: {
          queryPlan: enhancedQueryPlan,
          gptDrivenAnalysis: true,
          subQuestionAnalysis: analysisResults.summary,
          consolidationMetadata: consolidationResult.analysisMetadata,
          classification
        }
      });

      streamManager.close();
    } else if (classification.category === 'GENERAL_MENTAL_HEALTH') {
      console.log('[chat-with-rag] STREAMING EXECUTING: GENERAL_MENTAL_HEALTH pipeline');
      // Handle general mental health queries (including conversational ones) in streaming mode
      streamManager.sendUserMessage("Processing your wellness question");
      streamManager.sendBackendTask("general_mental_health", "Generating helpful response");
      
      try {
        const { data: generalResponse, error: generalError } = await supabaseClient.functions.invoke(
          'general-mental-health-chat',
          {
            body: { message, conversationContext }
          }
        );

        if (generalError) {
          throw new Error(`General mental health chat failed: ${generalError.message}`);
        }

        streamManager.sendEvent('final_response', {
          response: generalResponse.response,
          analysis: {
            queryType: 'general_mental_health',
            classification,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Fallback response
        streamManager.sendEvent('final_response', {
          response: "I understand you're reaching out. For questions about your personal journal insights, I'm here to help analyze your entries. For general wellness information, feel free to ask specific questions!",
          analysis: {
            queryType: 'general_fallback',
            classification,
            timestamp: new Date().toISOString()
          }
        });
      }

      streamManager.close();
    } else {
      // Handle unknown categories
      streamManager.sendEvent('final_response', {
        response: "I understand you're reaching out. For questions about your personal journal insights, I'm here to help analyze your entries.",
        analysis: {
          queryType: 'unknown_category',
          classification,
          timestamp: new Date().toISOString()
        }
      });

      streamManager.close();
    }

  } catch (error) {
    streamManager.sendEvent('error', { error: error.message });
    streamManager.close();
  }
}