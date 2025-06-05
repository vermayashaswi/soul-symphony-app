
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { EnhancedCacheManager } from './utils/enhancedCacheManager.ts';
import { Phase2Optimizer } from './utils/phase2Optimizer.ts';
import { AdvancedCacheManager } from './utils/advancedCacheManager.ts';
import { SmartQueryRouter } from './utils/smartQueryRouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('[Chat-with-RAG] Phase 2 Enhanced Processing Started');

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

    console.log(`[Chat-with-RAG] Processing with Phase 2 optimizations: "${message}"`);

    // PHASE 2 OPTIMIZATION: Smart Query Analysis and Routing
    const queryComplexity = message.length > 100 || 
                           /\b(analyze|compare|pattern|trend|most|top|all|every|summary|overview)\b/i.test(message)
                           ? 'complex' 
                           : message.length > 50 ? 'moderate' : 'simple';

    const expectedResultType = /\b(feel|emotion|mood|sentiment)\b/i.test(message) 
                              ? 'emotional' 
                              : /\b(analyze|pattern|trend|insight)\b/i.test(message) 
                              ? 'analytical' 
                              : 'factual';

    // Get user profile with caching
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('timezone, subscription_status, journal_focus_areas')
      .eq('id', userId)
      .single();

    // Estimate entry count for routing decisions
    const { count: entryCount } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // PHASE 2: Smart Query Routing
    const queryContext = {
      message,
      userId,
      complexity: queryComplexity,
      hasTimeContext: hasExplicitTimeReference,
      hasPersonalPronouns,
      entryCount: entryCount || 0,
      expectedResultType
    };

    const routing = await SmartQueryRouter.routeQuery(queryContext);
    console.log(`[Chat-with-RAG] Smart routing selected: ${routing.primaryRoute}`);

    // PHASE 2: Advanced Cache Check with Context Awareness
    const advancedCacheKey = AdvancedCacheManager.generateQueryHash(
      message,
      userId,
      {
        queryPlan: routing.primaryRoute,
        useAllEntries,
        hasPersonalPronouns,
        timeRange: queryPlan.timeRange,
        complexity: queryComplexity
      }
    );

    // Check for cached response (string response from orchestrator)
    const advancedResponseCache = AdvancedCacheManager.getCachedResponse(
      advancedCacheKey,
      { maxAge: routing.primaryRoute === 'fast_track' ? 15 * 60 * 1000 : 10 * 60 * 1000 }
    );

    if (advancedResponseCache.cacheHit) {
      console.log('[Chat-with-RAG] Advanced response cache hit - returning cached response');
      Phase2Optimizer.recordPerformanceMetric('cache_hit', Date.now() - startTime);
      
      return new Response(JSON.stringify({
        response: advancedResponseCache.response,
        analysis: {
          queryType: 'advanced_cached_response',
          cacheHit: true,
          cacheAge: advancedResponseCache.ageMs,
          timestamp: new Date().toISOString(),
          optimizationsApplied: ['phase2_advanced_caching', 'smart_routing'],
          routeUsed: routing.primaryRoute
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PHASE 2: Adaptive Execution with Smart Routing
    const routeConfig = SmartQueryRouter.getRouteConfiguration(routing.primaryRoute);
    
    const executionResult = await SmartQueryRouter.executeWithAdaptiveRouting(
      queryContext,
      async (config) => {
        // Enhanced query planning with Phase 2 optimizations
        const phase2QueryPlan = await Phase2Optimizer.optimizeQuery(queryContext);
        
        const enhancedQueryPlan = {
          ...queryPlan,
          ...phase2QueryPlan,
          optimizedParams: {
            entryLimit: useAllEntries ? config.processingLimits.maxEntries : Math.min(config.processingLimits.maxEntries, 8),
            useParallelSearch: true,
            intelligentModelSelection: true,
            optimizedContext: true,
            maxConcurrency: config.maxConcurrency,
            skipOperations: phase2QueryPlan.skipOperations
          }
        };

        // Route to enhanced GPT Master Orchestrator with Phase 2 parameters
        console.log('[Chat-with-RAG] Routing to Phase 2 Enhanced GPT Master Orchestrator');
        
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
              optimizedParams: enhancedQueryPlan.optimizedParams,
              phase2Config: {
                route: routing.primaryRoute,
                optimizations: routing.optimizations,
                expectedPerformance: routing.expectedPerformance
              }
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

        return orchestratorResponse;
      }
    );

    const { result: orchestratorResponse, routeUsed, performanceMs, adaptationsApplied } = executionResult;

    // PHASE 2: Advanced Response Caching - Cache the string response appropriately
    if (typeof orchestratorResponse.response === 'string') {
      AdvancedCacheManager.setCachedResponse(
        advancedCacheKey,
        orchestratorResponse.response,
        { 
          priority: routeUsed === 'fast_track' ? 'high' : 'normal'
        }
      );
    } else if (Array.isArray(orchestratorResponse.response)) {
      // If the response is an array, use the query results cache
      AdvancedCacheManager.setCachedQueryResults(
        advancedCacheKey,
        orchestratorResponse.response,
        { 
          compressionLevel: queryComplexity === 'simple' ? 2 : 1,
          priority: routeUsed === 'fast_track' ? 'high' : 'normal'
        }
      );
    } else {
      console.warn('[Chat-with-RAG] Unexpected response type for caching:', typeof orchestratorResponse.response);
    }

    // PHASE 2: Memory Optimization
    const memoryOptimization = Phase2Optimizer.optimizeMemoryUsage();
    
    // Record performance metrics
    Phase2Optimizer.recordPerformanceMetric('total_processing', performanceMs, {
      route: routeUsed,
      adaptations: adaptationsApplied,
      complexity: queryComplexity
    });

    // Enhanced response with Phase 2 metadata
    const enhancedResponse = {
      ...orchestratorResponse,
      analysis: {
        ...orchestratorResponse.analysis,
        phase2Optimizations: {
          routeUsed,
          adaptationsApplied,
          performanceMs,
          memoryOptimized: memoryOptimization.memoryFreed > 0,
          queryComplexity,
          expectedResultType,
          cacheStrategy: 'advanced_contextual'
        },
        optimizationsApplied: [
          ...(orchestratorResponse.analysis?.optimizationsApplied || []),
          'phase2_smart_routing',
          'phase2_advanced_caching',
          'phase2_adaptive_execution',
          'phase2_memory_optimization'
        ]
      }
    };
    
    const totalTime = Date.now() - startTime;
    console.log(`[Chat-with-RAG] Phase 2 processing completed in ${totalTime}ms using route: ${routeUsed}`);
    
    return new Response(JSON.stringify(enhancedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in Phase 2 enhanced chat-with-rag function:', error);
    
    // Phase 2 Error handling with performance tracking
    Phase2Optimizer.recordPerformanceMetric('error', Date.now(), { error: error.message });
    
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm sorry, I encountered an error while analyzing your journal entries. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'phase2_processing_error',
        timestamp: new Date().toISOString(),
        phase2Status: 'error_fallback_applied'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
