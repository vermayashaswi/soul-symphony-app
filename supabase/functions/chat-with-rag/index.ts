
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OptimizedRagPipeline } from './utils/optimizedPipeline.ts'
import { OptimizedApiClient } from './utils/optimizedApiClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[ChatWithRAG] Received ${req.method} request`);
    
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData = await req.json();
    const { message, userId, conversationContext = [], userProfile = {} } = requestData;
    
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: message and userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ChatWithRAG] Processing query for user: ${userId}`);
    console.log(`[ChatWithRAG] Message: ${message}`);

    // Get API keys
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[ChatWithRAG] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Step 1: Call smart query planner to get query plan with embeddings
    console.log('[ChatWithRAG] Calling smart query planner...');
    
    let queryPlanResponse;
    try {
      queryPlanResponse = await supabase.functions.invoke('smart-query-planner', {
        body: { 
          message, 
          userId, 
          timeRange: userProfile.timezone ? { timezone: userProfile.timezone } : undefined 
        }
      });

      if (queryPlanResponse.error) {
        console.error('[ChatWithRAG] Query planner error:', queryPlanResponse.error);
        throw new Error(`Query planner failed: ${queryPlanResponse.error.message}`);
      }
    } catch (error) {
      console.error('[ChatWithRAG] Failed to call smart query planner:', error);
      // Fallback: create basic query plan and generate embedding here
      console.log('[ChatWithRAG] Falling back to basic query plan with local embedding generation');
      
      try {
        const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);
        queryPlanResponse = {
          data: {
            success: true,
            queryPlan: {
              strategy: 'comprehensive',
              complexity: 'simple',
              requiresTimeFilter: false,
              requiresAggregation: false,
              expectedResponseType: 'narrative',
              subQueries: [message],
              filters: {},
              embeddingNeeded: true,
              queryEmbedding,
              embeddingDimensions: queryEmbedding.length,
              subQueryCount: 1,
              timestamp: new Date().toISOString()
            }
          }
        };
        console.log('[ChatWithRAG] Generated fallback query plan with embedding');
      } catch (embeddingError) {
        console.error('[ChatWithRAG] Failed to generate fallback embedding:', embeddingError);
        throw new Error('Unable to process query - both query planner and fallback embedding generation failed');
      }
    }

    const { queryPlan } = queryPlanResponse.data;
    console.log('[ChatWithRAG] Received query plan:', {
      strategy: queryPlan.strategy,
      complexity: queryPlan.complexity,
      embeddingDimensions: queryPlan.embeddingDimensions,
      subQueryCount: queryPlan.subQueryCount
    });

    // Validate embedding
    if (!queryPlan.queryEmbedding || !OptimizedApiClient.validateEmbedding(queryPlan.queryEmbedding)) {
      console.error('[ChatWithRAG] Invalid or missing embedding in query plan');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid embedding generated for query',
          details: 'The semantic search component is not available'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize and run the optimized RAG pipeline (synchronously)
    const pipeline = new OptimizedRagPipeline(supabase, openaiApiKey);
    
    // Process the query with the enhanced pipeline
    const result = await pipeline.processQuerySync({
      ...requestData,
      queryPlan
    });

    // Return the result as JSON
    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('[ChatWithRAG] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
