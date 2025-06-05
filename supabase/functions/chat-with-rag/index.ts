
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { EnhancedCacheManager } from './utils/enhancedCacheManager.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const requestBody = await req.json();
    const { 
      message, 
      userId, 
      threadId, 
      conversationContext = [], 
      queryPlan = {},
      useAllEntries = false,
      hasPersonalPronouns = false,
      hasExplicitTimeReference = false,
      threadMetadata = {}
    } = requestBody;

    console.log(`[Chat-with-RAG] Processing with Phase 1 optimizations: "${message}"`);

    // PHASE 1 OPTIMIZATION: Enhanced response cache with intelligent key generation
    const cacheKey = EnhancedCacheManager.generateQueryHash(
      message,
      userId,
      {
        queryPlan: queryPlan.strategy || 'standard',
        useAllEntries,
        hasPersonalPronouns,
        timeRange: queryPlan.timeRange
      }
    );

    const cachedResponse = EnhancedCacheManager.getCachedResponse(cacheKey);
    if (cachedResponse) {
      console.log('[Chat-with-RAG] Cache hit - returning optimized cached response');
      return new Response(JSON.stringify({
        response: cachedResponse,
        analysis: {
          queryType: 'cached_response',
          cacheHit: true,
          timestamp: new Date().toISOString(),
          optimizationsApplied: ['response_caching']
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile with minimal data for performance
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('timezone, subscription_status, journal_focus_areas')
      .eq('id', userId)
      .single();

    // Enhanced query planning for Phase 1 optimizations
    const enhancedQueryPlan = {
      ...queryPlan,
      optimizedParams: {
        entryLimit: useAllEntries ? 20 : 8,
        useParallelSearch: true,
        intelligentModelSelection: true,
        optimizedContext: true
      }
    };

    // Route to optimized GPT Master Orchestrator
    console.log('[Chat-with-RAG] Routing to optimized GPT Master Orchestrator');
    
    const { data: orchestratorResponse, error: orchestratorError } = await supabaseClient.functions.invoke(
      'gpt-master-orchestrator',
      {
        body: {
          message,
          userId,
          threadId,
          conversationContext,
          userProfile: userProfile || {},
          queryPlan: enhancedQueryPlan,
          optimizedParams: enhancedQueryPlan.optimizedParams
        }
      }
    );

    if (orchestratorError) {
      console.error('[Chat-with-RAG] Orchestrator error:', orchestratorError);
      throw new Error(`Failed to process request: ${orchestratorError.message}`);
    }

    if (!orchestratorResponse || !orchestratorResponse.response) {
      throw new Error('No response received from orchestrator');
    }

    // Cache the response for future use with enhanced caching
    EnhancedCacheManager.setCachedResponse(cacheKey, orchestratorResponse.response);
    
    // Add optimization metadata to response
    const enhancedResponse = {
      ...orchestratorResponse,
      analysis: {
        ...orchestratorResponse.analysis,
        optimizationsApplied: [
          ...(orchestratorResponse.analysis?.optimizationsApplied || []),
          'enhanced_caching',
          'optimized_routing'
        ]
      }
    };
    
    console.log('[Chat-with-RAG] Phase 1 optimized processing successful');
    return new Response(JSON.stringify(enhancedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in optimized chat-with-rag function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm sorry, I encountered an error while analyzing your journal entries. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'processing_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
