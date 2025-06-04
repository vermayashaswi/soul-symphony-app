
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { generateDatabaseSchemaContext } from '../_shared/databaseSchemaContext.ts';

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

    const { 
      message, 
      userId, 
      threadId, 
      conversationContext = [], 
      userProfile = {}
    } = await req.json();

    console.log('[GPT Master Orchestrator] Processing intelligent query with database schema awareness:', message);

    // Step 1: Generate intelligent query plan with database context
    const { data: queryPlanResponse } = await supabaseClient.functions.invoke(
      'intelligent-query-planner',
      {
        body: {
          message,
          userId,
          conversationContext,
          userProfile
        }
      }
    );

    if (!queryPlanResponse?.queryPlan) {
      throw new Error('Failed to generate query plan');
    }

    const { queryPlan, userPatterns, databaseContext } = queryPlanResponse;
    console.log('[Master Orchestrator] Schema-aware query plan generated:', queryPlan.strategy);

    // Step 2: Execute intelligent search orchestration with schema awareness
    const { data: searchResponse } = await supabaseClient.functions.invoke(
      'gpt-search-orchestrator',
      {
        body: {
          queryPlan,
          originalQuery: message,
          userId
        }
      }
    );

    if (!searchResponse) {
      throw new Error('Failed to execute search orchestration');
    }

    const { searchResults, combinedResults, executionSummary } = searchResponse;
    console.log('[Master Orchestrator] Schema-aware search completed:', executionSummary);

    // Step 3: Generate intelligent response with database schema context
    const { data: responseData } = await supabaseClient.functions.invoke(
      'intelligent-response-generator',
      {
        body: {
          originalQuery: message,
          searchResults,
          combinedResults,
          queryPlan,
          conversationContext,
          userProfile
        }
      }
    );

    if (!responseData?.response) {
      throw new Error('Failed to generate intelligent response');
    }

    console.log('[Master Orchestrator] Schema-aware intelligent response generated successfully');

    // Return comprehensive result with database schema awareness
    return new Response(JSON.stringify({
      response: responseData.response,
      metadata: {
        queryStrategy: queryPlan.strategy,
        searchMethodsUsed: queryPlan.searchMethods,
        totalResults: combinedResults.length,
        confidence: queryPlan.confidence,
        userPatterns,
        executionSummary,
        databaseSchemaAware: true,
        schemaUtilization: searchResults.map(r => r.schemaUtilization).filter(Boolean)
      },
      analysis: {
        queryType: 'intelligent_orchestration_with_schema',
        reasoning: queryPlan.reasoning,
        searchMethods: queryPlan.searchMethods,
        filtersApplied: queryPlan.filters,
        databaseContext: queryPlan.databaseContext
      },
      references: combinedResults.slice(0, 3).map(result => ({
        ...result,
        schemaFields: {
          hasEmotions: !!result.emotions,
          hasThemes: !!(result.master_themes || result.themes),
          hasSentiment: !!result.sentiment,
          contentSource: result["refined text"] ? "refined" : "transcription"
        }
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT master orchestrator:', error);
    
    // Fallback to basic response
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an issue while processing your request. Let me try to help you with a simpler approach to your question.",
      metadata: {
        queryStrategy: 'fallback',
        searchMethodsUsed: ['error_recovery'],
        totalResults: 0,
        confidence: 0.3,
        databaseSchemaAware: false
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
