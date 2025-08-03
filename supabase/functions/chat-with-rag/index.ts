
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { OptimizedApiClient } from './utils/optimizedApiClient.ts';
import { DualSearchOrchestrator } from './utils/dualSearchOrchestrator.ts';
import { AsyncSearchOrchestrator } from './utils/asyncSearchOrchestrator.ts';
import { DirectResponseHandler } from './utils/directResponseHandler.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './utils/responseGenerator.ts';
import { planQuery } from './utils/queryPlanner.ts';
// Rate limiting temporarily removed - tables deleted from database
import { createStreamingResponse, SSEStreamManager } from './utils/streamingResponseManager.ts';
import { BackgroundTaskManager } from './utils/backgroundTaskManager.ts';
import { SmartCache } from './utils/smartCache.ts';
import { OptimizedRagPipeline } from './utils/optimizedPipeline.ts';
import { PerformanceOptimizer } from './utils/performanceOptimizer.ts';
import { analyzeQueryComplexity } from './utils/queryComplexityAnalyzer.ts';

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
  let statusCode = 200;
  let errorMessage: string | undefined;

  try {
    console.log('[chat-with-rag] Starting optimized RAG processing with streaming support');

    // Performance tracking
    const globalTimer = PerformanceOptimizer.startTimer('total_request');
    
    // Rate limiting temporarily disabled - using basic request info extraction
    const authHeader = req.headers.get('Authorization');
    let userId: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (error) {
        console.warn('Failed to parse auth token:', error);
      }
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req.headers.get('x-real-ip') ||
                     req.headers.get('cf-connecting-ip') ||
                     '127.0.0.1';

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
      queryPlan = null,
      streaming = false
    } = requestBody;

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${requestUserId}, streaming: ${streaming}`);

    // NEW: Check if this should be handled as a direct response (no journal search needed)
    if (DirectResponseHandler.shouldHandleDirectly(message, conversationContext, queryPlan)) {
      console.log('[chat-with-rag] Routing to direct response handler');
      
      try {
        const directResponse = await DirectResponseHandler.generateDirectResponse(
          message,
          conversationContext,
          openaiApiKey,
          userProfile
        );

        console.log(`[chat-with-rag] Direct response completed in ${directResponse.analysis.processingTime}ms`);

        return new Response(JSON.stringify(directResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('[chat-with-rag] Direct response failed, falling back to journal search:', error);
        // Continue to journal search as fallback
      }
    }

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
            
            // Usage logging disabled - related tables removed
            console.log(`[chat-with-rag] Streaming completed in ${PerformanceOptimizer.endTimer(globalTimer, 'total_request')}ms`);
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

    // Traditional non-streaming approach with optimizations
    const cacheTimer = PerformanceOptimizer.startTimer('cache_check');
    
    // Check cache first
    const cacheKey = SmartCache.generateKey(message, requestUserId, conversationContext.length);
    const cachedResult = SmartCache.get(cacheKey);
    
    PerformanceOptimizer.endTimer(cacheTimer, 'cache_check');
    
    if (cachedResult) {
      console.log('[chat-with-rag] Cache hit - returning cached result');
      
      // Usage logging disabled - related tables removed
      console.log(`[chat-with-rag] Cache hit, completed in ${PerformanceOptimizer.endTimer(globalTimer, 'total_request')}ms`);

      return new Response(JSON.stringify({
        ...cachedResult,
        analysis: {
          ...cachedResult.analysis,
          fromCache: true,
          cacheHit: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced query planning with async optimization
    const planningTimer = PerformanceOptimizer.startTimer('query_planning');
    const enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
    PerformanceOptimizer.endTimer(planningTimer, 'query_planning');
    
    // Determine complexity for async optimization
    const complexity = analyzeQueryComplexity(message, conversationContext, enhancedQueryPlan);
    
    console.log(`[chat-with-rag] Query plan strategy: ${enhancedQueryPlan.strategy}, complexity: ${complexity}`);

    // NEW: Use async search orchestrator for high-performance search
    const searchTimer = PerformanceOptimizer.startTimer('async_search');
    
    console.log(`[chat-with-rag] Executing async ${complexity} search`);
    
    const asyncOrchestrator = new AsyncSearchOrchestrator(supabaseClient, openaiApiKey);
    
    const searchResults = await PerformanceOptimizer.withConnectionPooling(async () => {
      return await asyncOrchestrator.executeAsyncSearch(
        requestUserId,
        message,
        enhancedQueryPlan,
        complexity
      );
    });

    const { vectorResults, sqlResults, combinedResults, performance } = searchResults;
    PerformanceOptimizer.endTimer(searchTimer, 'async_search');

    console.log(`[chat-with-rag] Async search completed: ${combinedResults.length} total results in ${performance.totalTime}ms`);

    // Detect analytical query
    const isAnalyticalQuery = enhancedQueryPlan.expectedResponseType === 'analysis' ||
      enhancedQueryPlan.expectedResponseType === 'aggregated' ||
      /\b(pattern|trend|when do|what time|how often|frequency|usually|typically|statistics|insights|breakdown|analysis)\b/i.test(message);

    // Generate prompts
    const promptTimer = PerformanceOptimizer.startTimer('prompt_generation');
    const systemPrompt = generateSystemPrompt(
      userProfile.timezone || 'UTC',
      enhancedQueryPlan.timeRange,
      enhancedQueryPlan.expectedResponseType,
      combinedResults.length,
      `Dual search analysis: ${vectorResults.length} vector + ${sqlResults.length} SQL results`,
      conversationContext,
      false,
      /\b(I|me|my|myself)\b/i.test(message),
      enhancedQueryPlan.requiresTimeFilter,
      'dual'
    );

    const userPrompt = generateUserPrompt(message, combinedResults, 'dual vector + SQL');
    PerformanceOptimizer.endTimer(promptTimer, 'prompt_generation');

    // Generate response with optimization
    const responseTimer = PerformanceOptimizer.startTimer('ai_response');
    console.log('[chat-with-rag] Generating enhanced response with dual search results');
    const aiResponse = await generateResponse(
      systemPrompt,
      userPrompt,
      conversationContext,
      openaiApiKey,
      isAnalyticalQuery
    );
    PerformanceOptimizer.endTimer(responseTimer, 'ai_response');

    processingTime = PerformanceOptimizer.endTimer(globalTimer, 'total_request');

    // Prepare final response
    const finalResponse = {
      response: aiResponse,
      analysis: {
        queryPlan: enhancedQueryPlan,
        searchMethod: searchResults.searchMethod || 'async_optimized',
        complexity,
        resultsBreakdown: {
          vector: vectorResults.length,
          sql: sqlResults.length,
          combined: combinedResults.length
        },
        isAnalyticalQuery,
        processingTime,
        enhancedFormatting: isAnalyticalQuery,
        asyncOptimizationsEnabled: true,
        fromCache: false,
        performanceReport: PerformanceOptimizer.getPerformanceReport(),
        searchPerformance: performance
      },
      referenceEntries: combinedResults.slice(0, 8).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.master_themes || [],
        emotions: entry.emotions || {},
        searchMethod: entry.searchMethod || 'combined'
      }))
    };

    // Cache result in background
    BackgroundTaskManager.getInstance().addTask(
      Promise.resolve(SmartCache.set(cacheKey, finalResponse, 300))
    );

    // Usage logging disabled - related tables removed
    console.log(`[chat-with-rag] Request completed successfully in ${processingTime}ms`);

    console.log(`[chat-with-rag] Enhanced dual search RAG completed in ${processingTime}ms`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in enhanced dual search RAG:', error);
    statusCode = 500;
    errorMessage = error.message;
    processingTime = Date.now() - startTime;

    // Error logging simplified - usage tables removed
    console.error(`[chat-with-rag] Request failed in ${processingTime}ms:`, errorMessage);

    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'dual_search_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
