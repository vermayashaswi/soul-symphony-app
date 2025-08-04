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

    // Enhanced query planning with dual search support
    const planningTimer = PerformanceOptimizer.startTimer('query_planning');
    const enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
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

    // ENHANCED: Dynamic response formatting based on query complexity
    const formatTimer = PerformanceOptimizer.startTimer('format_determination');
    
    // Enhanced sub-question generation for complex queries
    const shouldGenerateMultiple = shouldGenerateMultipleSubQuestions(message, enhancedQueryPlan);
    let actualSubQuestions = [];
    
    if (shouldGenerateMultiple) {
      actualSubQuestions = generateSubQuestions(message, enhancedQueryPlan, conversationContext);
      console.log(`[chat-with-rag] Generated ${actualSubQuestions.length} sub-questions for complex analysis`);
    } else {
      actualSubQuestions = [{ question: message, type: 'specific', priority: 1, searchStrategy: 'hybrid' }];
    }
    
    // Create sub-question results for format determination
    const mockSubResults = actualSubQuestions.map(q => ({ 
      context: 'mock', 
      subQuestion: typeof q === 'string' ? { question: q } : q 
    }));
    const responseFormat = determineResponseFormat(message, enhancedQueryPlan, conversationContext, mockSubResults);
    
    PerformanceOptimizer.endTimer(formatTimer, 'format_determination');
    
    console.log(`[chat-with-rag] Using ${responseFormat.formatType} format with complexity: ${responseFormat.complexity}`);

    // Generate enhanced prompts with dynamic formatting
    const promptTimer = PerformanceOptimizer.startTimer('prompt_generation');
    
    // Combine results into structured context for multi-question scenarios
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
    
    PerformanceOptimizer.endTimer(promptTimer, 'prompt_generation');

    // Generate response with enhanced formatting
    const responseTimer = PerformanceOptimizer.startTimer('ai_response');
    console.log(`[chat-with-rag] Generating ${responseFormat.formatType} response with dual search results`);
    const aiResponse = await generateResponse(
      systemPrompt,
      userPrompt,
      conversationContext,
      openaiApiKey,
      responseFormat.complexity !== 'simple'
    );
    PerformanceOptimizer.endTimer(responseTimer, 'ai_response');

    processingTime = PerformanceOptimizer.endTimer(globalTimer, 'total_request');

    // Prepare enhanced final response
    const finalResponse = {
      response: aiResponse,
      analysis: {
        queryPlan: enhancedQueryPlan,
        searchMethod: `dual_${searchMethod}`,
        responseFormat: responseFormat,
        resultsBreakdown: {
          vector: vectorResults.length,
          sql: sqlResults.length,
          combined: combinedResults.length
        },
        isAnalyticalQuery: responseFormat.complexity !== 'simple',
        processingTime,
        enhancedFormatting: responseFormat.useStructuredFormat,
        multiQuestionGeneration: enhancedQueryPlan.subQuestions?.length > 1,
        dualSearchEnabled: true,
        fromCache: false,
        performanceReport: PerformanceOptimizer.getPerformanceReport()
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