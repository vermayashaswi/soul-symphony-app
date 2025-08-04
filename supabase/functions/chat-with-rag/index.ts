import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { OptimizedApiClient } from './utils/optimizedApiClient.ts';
import { DualSearchOrchestrator } from './utils/dualSearchOrchestrator.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './utils/responseGenerator.ts';
import { planQuery } from './utils/queryPlanner.ts';
import { createStreamingResponse, SSEStreamManager } from './utils/streamingResponseManager.ts';
import { BackgroundTaskManager } from './utils/backgroundTaskManager.ts';
import { SmartCache } from './utils/smartCache.ts';
import { OptimizedRagPipeline } from './utils/optimizedPipeline.ts';
import { PerformanceOptimizer } from './utils/performanceOptimizer.ts';
import { determineResponseFormat, generateSystemPromptWithFormat, combineSubQuestionResults } from './utils/dynamicResponseFormatter.ts';
import { generateSubQuestions, shouldGenerateMultipleSubQuestions } from './utils/enhancedSubQuestionGenerator.ts';
import { SearchDebugger } from './utils/searchDebugger.ts';

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

    // Traditional non-streaming approach with optimizations
    const cacheTimer = PerformanceOptimizer.startTimer('cache_check');
    
    // Check cache first
    const cacheKey = SmartCache.generateKey(message, requestUserId, conversationContext.length);
    const cachedResult = SmartCache.get(cacheKey);
    
    PerformanceOptimizer.endTimer(cacheTimer, 'cache_check');
    
    if (cachedResult) {
      console.log('[chat-with-rag] Cache hit - returning cached result');
      
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

    // ENHANCED: Use GPT-powered query planning via smart-query-planner
    const planningTimer = PerformanceOptimizer.startTimer('query_planning');
    let enhancedQueryPlan;
    
    try {
      // Call the smart-query-planner edge function for GPT-driven planning
      const { data: gptPlan, error: plannerError } = await supabaseClient.functions.invoke(
        'smart-query-planner',
        {
          body: {
            message,
            userId: requestUserId,
            conversationContext,
            userProfile,
            timeRange: userProfile.timeRange || null
          }
        }
      );
      
      if (plannerError) {
        console.warn('[chat-with-rag] GPT planner error, falling back to local planning:', plannerError);
        enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
      } else {
        enhancedQueryPlan = gptPlan.queryPlan;
        console.log('[chat-with-rag] Using GPT-generated query plan:', enhancedQueryPlan);
      }
    } catch (error) {
      console.warn('[chat-with-rag] GPT planner unavailable, using local planning:', error);
      enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
    }
    
    PerformanceOptimizer.endTimer(planningTimer, 'query_planning');
    
    console.log(`[chat-with-rag] Query plan strategy: ${enhancedQueryPlan.strategy}, complexity: ${enhancedQueryPlan.complexity}`);

    // Generate embedding with optimization and debugging
    SearchDebugger.reset();
    const embeddingTimer = PerformanceOptimizer.startTimer('embedding_generation');
    const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);
    PerformanceOptimizer.endTimer(embeddingTimer, 'embedding_generation');
    
    // Debug query processing
    SearchDebugger.logQueryProcessing(message, message.trim(), queryEmbedding);

    // Execute optimized dual search
    const searchTimer = PerformanceOptimizer.startTimer('dual_search');
    const searchMethod = DualSearchOrchestrator.shouldUseParallelExecution(enhancedQueryPlan) ? 
      'parallel' : 'sequential';
    
    console.log(`[chat-with-rag] Executing ${searchMethod} dual search`);
    
    const searchResults = await PerformanceOptimizer.withConnectionPooling(async () => {
      return searchMethod === 'parallel' ?
        await DualSearchOrchestrator.executeParallelSearch(
          supabaseClient,
          requestUserId,
          queryEmbedding,
          enhancedQueryPlan,
          message
        ) :
        await DualSearchOrchestrator.executeSequentialSearch(
          supabaseClient,
          requestUserId,
          queryEmbedding,
          enhancedQueryPlan,
          message
        );
    });

    const { vectorResults, sqlResults, combinedResults } = searchResults;
    PerformanceOptimizer.endTimer(searchTimer, 'dual_search');

    console.log(`[chat-with-rag] Dual search completed: ${combinedResults.length} total results`);

    // ENHANCED: GPT-driven sub-question analysis and response consolidation
    const analysisTimer = PerformanceOptimizer.startTimer('gpt_analysis');
    let aiResponse;
    let finalAnalysisData = {};

    // Check if we should use GPT-driven analysis for complex queries
    const shouldUseGptAnalysis = enhancedQueryPlan.subQuestions && enhancedQueryPlan.subQuestions.length > 1;
    
    if (shouldUseGptAnalysis) {
      console.log(`[chat-with-rag] Using GPT-driven analysis pipeline for ${enhancedQueryPlan.subQuestions.length} sub-questions`);
      
      try {
        // Step 1: Call GPT Analysis Orchestrator for sub-question analysis
        const { data: analysisResults, error: analysisError } = await supabaseClient.functions.invoke(
          'gpt-analysis-orchestrator',
          {
            body: {
              subQuestions: enhancedQueryPlan.subQuestions,
              userMessage: message,
              userId: requestUserId,
              timeRange: enhancedQueryPlan.timeRange
            }
          }
        );

        if (analysisError) {
          console.warn('[chat-with-rag] Analysis orchestrator error, falling back to simple response:', analysisError);
          throw new Error('Analysis orchestrator failed');
        }

        // Step 2: Call GPT Response Consolidator to synthesize the results
        const { data: consolidationResult, error: consolidationError } = await supabaseClient.functions.invoke(
          'gpt-response-consolidator',
          {
            body: {
              userMessage: message,
              analysisResults: analysisResults.analysisResults,
              conversationContext,
              userProfile,
              streamingMode: false
            }
          }
        );

        if (consolidationError) {
          console.warn('[chat-with-rag] Response consolidator error, falling back to simple response:', consolidationError);
          throw new Error('Response consolidator failed');
        }

        aiResponse = consolidationResult.response;
        finalAnalysisData = {
          gptDrivenAnalysis: true,
          subQuestionAnalysis: analysisResults.summary,
          consolidationMetadata: consolidationResult.analysisMetadata
        };

        console.log('[chat-with-rag] Successfully completed GPT-driven analysis pipeline');

      } catch (gptError) {
        console.warn('[chat-with-rag] GPT analysis pipeline failed, falling back to traditional approach:', gptError);
        
        // Fallback to traditional approach
        const responseFormat = determineResponseFormat(message, enhancedQueryPlan, conversationContext, []);
        const contextData = combinedResults.length > 0 ? 
          combinedResults.map(entry => ({
            content: entry.content,
            created_at: entry.created_at,
            themes: entry.master_themes || [],
            emotions: entry.emotions || {},
            searchMethod: entry.searchMethod || 'dual'
          })).slice(0, 20).map(entry => 
            `Entry (${entry.created_at}): ${entry.content?.slice(0, 300) || 'No content'} [Themes: ${entry.themes.join(', ')}] [Search: ${entry.searchMethod}]`
          ).join('\n\n') :
          'No relevant entries found.';
        
        const systemPrompt = generateSystemPromptWithFormat(responseFormat, message, contextData, enhancedQueryPlan);
        const userPrompt = generateUserPrompt(message, combinedResults, 'dual vector + SQL');
        
        aiResponse = await generateResponse(
          systemPrompt,
          userPrompt,
          conversationContext,
          openaiApiKey,
          responseFormat.complexity !== 'simple'
        );

        finalAnalysisData = {
          gptDrivenAnalysis: false,
          fallbackReason: gptError.message,
          traditionalApproach: true
        };
      }
    } else {
      // Simple query - use traditional approach
      console.log('[chat-with-rag] Using traditional response generation for simple query');
      
      const responseFormat = determineResponseFormat(message, enhancedQueryPlan, conversationContext, []);
      const contextData = combinedResults.length > 0 ? 
        combinedResults.map(entry => ({
          content: entry.content,
          created_at: entry.created_at,
          themes: entry.master_themes || [],
          emotions: entry.emotions || {},
          searchMethod: entry.searchMethod || 'dual'
        })).slice(0, 20).map(entry => 
          `Entry (${entry.created_at}): ${entry.content?.slice(0, 300) || 'No content'} [Themes: ${entry.themes.join(', ')}] [Search: ${entry.searchMethod}]`
        ).join('\n\n') :
        'No relevant entries found.';
      
      const systemPrompt = generateSystemPromptWithFormat(responseFormat, message, contextData, enhancedQueryPlan);
      const userPrompt = generateUserPrompt(message, combinedResults, 'dual vector + SQL');
      
      aiResponse = await generateResponse(
        systemPrompt,
        userPrompt,
        conversationContext,
        openaiApiKey,
        responseFormat.complexity !== 'simple'
      );

      finalAnalysisData = {
        gptDrivenAnalysis: false,
        simpleQuery: true
      };
    }
    
    PerformanceOptimizer.endTimer(analysisTimer, 'gpt_analysis');

    processingTime = PerformanceOptimizer.endTimer(globalTimer, 'total_request');

    // Prepare enhanced final response
    const finalResponse = {
      response: aiResponse,
      analysis: {
        queryPlan: enhancedQueryPlan,
        searchMethod: `dual_${searchMethod}`,
        resultsBreakdown: {
          vector: vectorResults.length,
          sql: sqlResults.length,
          combined: combinedResults.length
        },
        processingTime,
        dualSearchEnabled: true,
        fromCache: false,
        performanceReport: PerformanceOptimizer.getPerformanceReport(),
        ...finalAnalysisData
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

    console.log(`[chat-with-rag] Enhanced dual search RAG completed in ${processingTime}ms`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in enhanced dual search RAG:', error);
    statusCode = 500;
    errorMessage = error.message;
    processingTime = Date.now() - startTime;

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