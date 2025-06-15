
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { OptimizedApiClient } from './utils/optimizedApiClient.ts';
import { DualSearchOrchestrator } from './utils/dualSearchOrchestrator.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './utils/responseGenerator.ts';
import { planQuery } from './utils/queryPlanner.ts';
import { RateLimitManager } from '../_shared/rateLimitUtils.ts';

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
    console.log('[chat-with-rag] Starting enhanced dual search RAG processing');

    // Initialize rate limiting
    const rateLimitManager = new RateLimitManager(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, ipAddress } = RateLimitManager.getClientInfo(req);

    // Check rate limits
    const rateLimitCheck = await rateLimitManager.checkRateLimit({
      userId,
      ipAddress,
      functionName: 'chat-with-rag'
    });

    if (!rateLimitCheck.allowed) {
      console.log(`[chat-with-rag] Rate limit exceeded for user ${userId || 'anonymous'} from IP ${ipAddress}`);
      return rateLimitManager.createRateLimitResponse(rateLimitCheck);
    }

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
      queryPlan = null
    } = requestBody;

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${requestUserId}`);

    // Enhanced query planning with dual search support
    const enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
    console.log(`[chat-with-rag] Query plan strategy: ${enhancedQueryPlan.strategy}, complexity: ${enhancedQueryPlan.complexity}`);

    // Generate embedding for vector search component
    console.log('[chat-with-rag] Generating query embedding for dual search');
    const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);

    // Execute dual search (always use both vector and SQL)
    const searchMethod = DualSearchOrchestrator.shouldUseParallelExecution(enhancedQueryPlan) ? 
      'parallel' : 'sequential';
    
    console.log(`[chat-with-rag] Executing ${searchMethod} dual search`);
    
    const searchResults = searchMethod === 'parallel' ?
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

    const { vectorResults, sqlResults, combinedResults } = searchResults;

    console.log(`[chat-with-rag] Dual search completed: ${combinedResults.length} total results`);

    // Detect if this is an analytical query for formatting
    const isAnalyticalQuery = enhancedQueryPlan.expectedResponseType === 'analysis' ||
      enhancedQueryPlan.expectedResponseType === 'aggregated' ||
      /\b(pattern|trend|when do|what time|how often|frequency|usually|typically|statistics|insights|breakdown|analysis)\b/i.test(message);

    // Generate enhanced system prompt with dual search context
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

    // Generate user prompt with formatted entries
    const userPrompt = generateUserPrompt(message, combinedResults, 'dual vector + SQL');

    // Generate response with enhanced formatting
    console.log('[chat-with-rag] Generating enhanced response with dual search results');
    const aiResponse = await generateResponse(
      systemPrompt,
      userPrompt,
      conversationContext,
      openaiApiKey,
      isAnalyticalQuery
    );

    processingTime = Date.now() - startTime;

    // Log successful API usage
    await rateLimitManager.logApiUsage({
      userId,
      ipAddress,
      functionName: 'chat-with-rag',
      statusCode,
      responseTimeMs: processingTime
    });

    console.log(`[chat-with-rag] Enhanced dual search RAG completed in ${processingTime}ms`);

    return new Response(JSON.stringify({
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
        processingTime,
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
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in enhanced dual search RAG:', error);
    statusCode = 500;
    errorMessage = error.message;
    processingTime = Date.now() - startTime;

    // Log failed API usage
    try {
      const rateLimitManager = new RateLimitManager(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { userId, ipAddress } = RateLimitManager.getClientInfo(req);
      
      await rateLimitManager.logApiUsage({
        userId,
        ipAddress,
        functionName: 'chat-with-rag',
        statusCode,
        responseTimeMs: processingTime,
        errorMessage
      });
    } catch (logError) {
      console.error('[chat-with-rag] Failed to log error usage:', logError);
    }

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
