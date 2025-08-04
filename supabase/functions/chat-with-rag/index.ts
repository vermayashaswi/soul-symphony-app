import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { OptimizedApiClient } from './utils/optimizedApiClient.ts';
import { createStreamingResponse, SSEStreamManager } from './utils/streamingResponseManager.ts';
import { BackgroundTaskManager } from './utils/backgroundTaskManager.ts';
import { SmartCache } from './utils/smartCache.ts';
import { OptimizedRagPipeline } from './utils/optimizedPipeline.ts';
import { PerformanceOptimizer } from './utils/performanceOptimizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let processingTime = 0;

  try {
    console.log('[chat-with-rag] Starting unified GPT-driven RAG processing');

    const globalTimer = PerformanceOptimizer.startTimer('total_request');
    
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
      streaming = false
    } = requestBody;

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${requestUserId}, streaming: ${streaming}`);

    // Check for streaming request
    if (streaming || req.headers.get('Accept') === 'text/event-stream') {
      const { response, controller } = createStreamingResponse();
      const streamManager = new SSEStreamManager(controller);
      const pipeline = new OptimizedRagPipeline(streamManager, supabaseClient, openaiApiKey);

      // Use background task for streaming pipeline
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            await pipeline.processQuery(requestBody);
          } catch (error) {
            console.error('[chat-with-rag] Streaming pipeline error:', error);
            await streamManager.sendEvent('error', { message: error.message });
          } finally {
            await streamManager.close();
          }
        })()
      );

      return response;
    }

    // Check cache first
    const cacheTimer = PerformanceOptimizer.startTimer('cache_check');
    const cacheKey = SmartCache.generateKey(message, requestUserId, conversationContext.length);
    const cachedResult = SmartCache.get(cacheKey);
    PerformanceOptimizer.endTimer(cacheTimer, 'cache_check');
    
    if (cachedResult) {
      console.log('[chat-with-rag] Cache hit - returning cached result');
      return new Response(JSON.stringify({
        ...cachedResult,
        analysis: { ...cachedResult.analysis, fromCache: true }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: GPT Query Planning - Always call, no fallbacks
    const planningTimer = PerformanceOptimizer.startTimer('query_planning');
    console.log('[chat-with-rag] Calling GPT smart query planner...');
    
    const { data: queryPlan, error: planError } = await supabaseClient.functions.invoke('smart-query-planner', {
      body: { 
        message: message, 
        userId: requestUserId,
        conversationContext,
        userProfile 
      }
    });
    
    if (planError || !queryPlan) {
      throw new Error(`GPT query planner failed: ${planError?.message || 'No plan returned'}`);
    }
    
    PerformanceOptimizer.endTimer(planningTimer, 'query_planning');
    console.log(`[chat-with-rag] Query plan strategy: ${queryPlan.strategy}, complexity: ${queryPlan.complexity}`);

    // Step 2: Generate Embedding
    const embeddingTimer = PerformanceOptimizer.startTimer('embedding_generation');
    const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);
    PerformanceOptimizer.endTimer(embeddingTimer, 'embedding_generation');

    // Step 3: Execute Enhanced RAG Orchestrator with GPT sub-questions
    const orchestratorTimer = PerformanceOptimizer.startTimer('enhanced_orchestrator');
    console.log('[chat-with-rag] Calling enhanced RAG orchestrator...');
    
    const { data: orchestrationResult, error: orchestrationError } = await supabaseClient.functions.invoke('enhanced-rag-orchestrator', {
      body: {
        userMessage: message,
        threadId: requestBody.threadId || 'default',
        conversationContext,
        userProfile,
        queryPlan,
        queryEmbedding
      }
    });
    
    if (orchestrationError || !orchestrationResult) {
      throw new Error(`Enhanced RAG orchestrator failed: ${orchestrationError?.message || 'No result returned'}`);
    }
    
    PerformanceOptimizer.endTimer(orchestratorTimer, 'enhanced_orchestrator');

    const { 
      subQuestions = [], 
      queryPlans = [], 
      searchResults = [], 
      finalResponse: aiResponse,
      metadata = {}
    } = orchestrationResult;

    processingTime = PerformanceOptimizer.endTimer(globalTimer, 'total_request');

    // Prepare unified final response using GPT orchestration results
    const finalResponse = {
      response: aiResponse,
      analysis: {
        queryPlan,
        subQuestions,
        queryPlans,
        searchMethod: 'enhanced_rag_orchestrator',
        resultsBreakdown: {
          totalResults: searchResults.length,
          subQuestions: subQuestions.length,
          orchestrated: true
        },
        isAnalyticalQuery: queryPlan.expectedResponse === 'analysis',
        processingTime,
        gptDriven: true,
        unifiedPipeline: true,
        fromCache: false,
        metadata,
        performanceReport: PerformanceOptimizer.getPerformanceReport()
      },
      referenceEntries: searchResults.slice(0, 8).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.themes || [],
        emotions: entry.emotions || {},
        searchMethod: entry.searchMethod || 'orchestrated'
      }))
    };

    // Cache result in background
    BackgroundTaskManager.getInstance().addTask(
      Promise.resolve(SmartCache.set(cacheKey, finalResponse, 300))
    );

    console.log(`[chat-with-rag] Unified GPT-driven RAG completed in ${processingTime}ms`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in unified GPT-driven RAG:', error);
    processingTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. The GPT-driven pipeline requires all components to be working properly.",
      analysis: {
        queryType: 'error',
        errorType: 'unified_pipeline_error',
        processingTime,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});