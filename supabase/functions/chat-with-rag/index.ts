import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[chat-with-rag] Starting streamlined RAG processing without caching or streaming');

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
      userProfile = {}
    } = requestBody;

    console.log(`[chat-with-rag] Processing query: "${message}" for user: ${requestUserId}`);

    // Step 1: Use GPT-powered query planning via smart-query-planner
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
        throw new Error(`GPT planner error: ${plannerError.message}`);
      }
      
      enhancedQueryPlan = gptPlan.queryPlan;
      console.log('[chat-with-rag] Using GPT-generated query plan:', enhancedQueryPlan);
    } catch (error) {
      console.error('[chat-with-rag] GPT planner failed:', error);
      throw new Error('Query planning failed');
    }
    
    console.log(`[chat-with-rag] Query plan strategy: ${enhancedQueryPlan.strategy}, complexity: ${enhancedQueryPlan.complexity}`);

    // Step 2: Check if we should use GPT-driven analysis (any sub-questions >= 1)
    const shouldUseGptAnalysis = enhancedQueryPlan.subQuestions && enhancedQueryPlan.subQuestions.length >= 1;
    
    if (shouldUseGptAnalysis) {
      console.log(`[chat-with-rag] Using GPT-driven analysis pipeline for ${enhancedQueryPlan.subQuestions.length} sub-questions`);
      
      // Step 3: Call GPT Analysis Orchestrator for sub-question analysis
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
        throw new Error(`Analysis orchestrator failed: ${analysisError.message}`);
      }

      // Step 4: Call GPT Response Consolidator to synthesize the results
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
        throw new Error(`Response consolidator failed: ${consolidationError.message}`);
      }

      console.log('[chat-with-rag] Successfully completed GPT-driven analysis pipeline');

      return new Response(JSON.stringify({
        response: consolidationResult.response,
        analysis: {
          queryPlan: enhancedQueryPlan,
          gptDrivenAnalysis: true,
          subQuestionAnalysis: analysisResults.summary,
          consolidationMetadata: consolidationResult.analysisMetadata
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error('No sub-questions generated - unable to process query');
    }

  } catch (error) {
    console.error('[chat-with-rag] Error in streamlined RAG:', error);

    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'rag_pipeline_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});