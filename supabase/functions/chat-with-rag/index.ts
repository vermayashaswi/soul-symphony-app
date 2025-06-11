import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { RateLimitService, OpenAIUsageTracker, createRateLimitMiddleware } from "../_shared/rateLimitService.ts";
import { OptimizedApiClient } from './utils/optimizedApiClient.ts';
import { DualSearchOrchestrator } from './utils/dualSearchOrchestrator.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './utils/responseGenerator.ts';
import { planQuery } from './utils/queryPlanner.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Initialize rate limiting and usage tracking
const rateLimitService = new RateLimitService(supabaseUrl, supabaseServiceKey);
const openAITracker = new OpenAIUsageTracker(supabaseUrl, supabaseServiceKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestStartTime = Date.now();
  let userId: string | null = null;
  let ipAddress: string | null = null;
  let responseStatus = 200;
  let errorMessage: string | null = null;
  let totalTokensUsed = 0;
  let totalCost = 0;

  try {
    // Apply rate limiting middleware
    const rateLimitCheck = await createRateLimitMiddleware(rateLimitService, 'chat-with-rag')(req, supabase);
    
    if (rateLimitCheck instanceof Response) {
      // Rate limit exceeded - response already created
      return rateLimitCheck;
    }

    // Extract middleware results
    userId = rateLimitCheck.userId;
    ipAddress = rateLimitCheck.ipAddress;
    requestStartTime = rateLimitCheck.startTime;

    console.log(`[Chat RAG] Request from user: ${userId || 'anonymous'}, IP: ${ipAddress}`);

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestData = await req.json();
    const { query, threadId, conversationContext = [], userId: requestUserId } = requestData;

    if (!query) {
      responseStatus = 400;
      throw new Error('Query parameter is required');
    }

    // Use userId from auth or fallback to request
    const effectiveUserId = userId || requestUserId;

    if (!effectiveUserId) {
      responseStatus = 401;
      throw new Error('Authentication required');
    }

    console.log(`[Chat RAG] Processing query: "${query}" for user: ${effectiveUserId}`);

    // Enhanced query planning with dual search support
    const enhancedQueryPlan = planQuery(query, effectiveUserId);
    console.log(`[Chat RAG] Query plan strategy: ${enhancedQueryPlan.strategy}, complexity: ${enhancedQueryPlan.complexity}`);

    // Generate embedding for vector search component
    console.log('[Chat RAG] Generating query embedding for dual search');
    const queryEmbedding = await OptimizedApiClient.getEmbedding(query, openAIApiKey);

    // Execute dual search (always use both vector and SQL)
    const searchMethod = DualSearchOrchestrator.shouldUseParallelExecution(enhancedQueryPlan) ? 
      'parallel' : 'sequential';
    
    console.log(`[Chat RAG] Executing ${searchMethod} dual search`);
    
    const searchResults = searchMethod === 'parallel' ?
      await DualSearchOrchestrator.executeParallelSearch(
        supabase,
        effectiveUserId,
        queryEmbedding,
        enhancedQueryPlan,
        query
      ) :
      await DualSearchOrchestrator.executeSequentialSearch(
        supabase,
        effectiveUserId,
        queryEmbedding,
        enhancedQueryPlan,
        query
      );

    const { vectorResults, sqlResults, combinedResults } = searchResults;

    console.log(`[Chat RAG] Dual search completed: ${combinedResults.length} total results`);

    // Detect if this is an analytical query for formatting
    const isAnalyticalQuery = enhancedQueryPlan.expectedResponseType === 'analysis' ||
      enhancedQueryPlan.expectedResponseType === 'aggregated' ||
      /\b(pattern|trend|when do|what time|how often|frequency|usually|typically|statistics|insights|breakdown|analysis)\b/i.test(query);

    // Generate enhanced system prompt with dual search context
    const systemPrompt = generateSystemPrompt(
      effectiveUserId,
      enhancedQueryPlan.timeRange,
      enhancedQueryPlan.expectedResponseType,
      combinedResults.length,
      `Dual search analysis: ${vectorResults.length} vector + ${sqlResults.length} SQL results`,
      conversationContext,
      false,
      /\b(I|me|my|myself)\b/i.test(query),
      enhancedQueryPlan.requiresTimeFilter,
      'dual'
    );

    // Generate user prompt with formatted entries
    const userPrompt = generateUserPrompt(query, combinedResults, 'dual vector + SQL');

    // Generate response with enhanced formatting
    console.log('[Chat RAG] Generating enhanced response with dual search results');
    const aiResponse = await generateResponse(
      systemPrompt,
      userPrompt,
      conversationContext,
      openAIApiKey,
      isAnalyticalQuery
    );

    const totalTime = Date.now() - requestStartTime;

    console.log(`[Chat RAG] Enhanced dual search RAG completed in ${totalTime}ms`);

    // Track OpenAI usage for each API call made
    const trackOpenAICall = async (model: string, promptTokens: number, completionTokens: number, requestId?: string) => {
      const cost = openAITracker.calculateCost(model, promptTokens, completionTokens);
      totalTokensUsed += promptTokens + completionTokens;
      totalCost += cost;

      await openAITracker.logOpenAIUsage({
        userId: effectiveUserId,
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costUsd: cost,
        functionName: 'chat-with-rag',
        requestId
      });
    };

    // Example of how to integrate tracking into OpenAI calls:
    // After each OpenAI API call, add:
    // if (openAIResponse.usage) {
    //   await trackOpenAICall(
    //     'gpt-4o-mini',
    //     openAIResponse.usage.prompt_tokens,
    //     openAIResponse.usage.completion_tokens,
    //     openAIResponse.id
    //   );
    // }

    const response = new Response(
      JSON.stringify({
        response: aiResponse,
        analysis: {
          queryPlan: enhancedQueryPlan,
          searchMethod: `dual_${searchMethod}`,
          resultsBreakdown: {
            vector: vectorResults.length,
            sql: sqlResults.length,
            combined: combinedResults.length
          },
          isAnalyticalQuery,
          processingTime: totalTime,
          enhancedFormatting: isAnalyticalQuery,
          dualSearchEnabled: true
        },
        referenceEntries: combinedResults.slice(0, 8).map(entry => ({
          id: entry.id,
          content: entry.content?.slice(0, 200) || 'No content',
          created_at: entry.created_at,
          themes: entry.master_themes || [],
          emotions: entry.emotions || {},
          searchMethod: entry.searchMethod || 'combined'
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

    // Log successful request
    await rateLimitService.logUsage({
      userId: effectiveUserId,
      ipAddress,
      functionName: 'chat-with-rag',
      statusCode: responseStatus,
      responseTimeMs: Date.now() - requestStartTime,
      tokensUsed: totalTokensUsed,
      costUsd: totalCost,
      userAgent: req.headers.get('user-agent') || undefined,
      referer: req.headers.get('referer') || undefined
    });

    return response;

  } catch (error) {
    console.error('[Chat RAG] Error:', error);
    errorMessage = error.message;
    
    if (responseStatus === 200) {
      responseStatus = 500;
    }

    // Log failed request
    await rateLimitService.logUsage({
      userId,
      ipAddress,
      functionName: 'chat-with-rag',
      statusCode: responseStatus,
      responseTimeMs: Date.now() - requestStartTime,
      tokensUsed: totalTokensUsed,
      costUsd: totalCost,
      errorMessage,
      userAgent: req.headers.get('user-agent') || undefined,
      referer: req.headers.get('referer') || undefined
    });

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
