
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
    } = await req.json();

    console.log(`[Chat-with-RAG] Processing with enhanced performance optimizations: "${message}"`);

    // PHASE 1 OPTIMIZATION: Check response cache first
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
      console.log('[Chat-with-RAG] Cache hit - returning cached response');
      return new Response(JSON.stringify({
        response: cachedResponse,
        analysis: {
          queryType: 'cached_response',
          cacheHit: true,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile for intelligent processing
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('timezone, subscription_status, journal_focus_areas')
      .eq('id', userId)
      .single();

    // Check complexity and route accordingly
    const shouldUseIntelligentOrchestration = shouldUseGPTOrchestration(message, conversationContext, queryPlan);

    if (shouldUseIntelligentOrchestration) {
      console.log('[Chat-with-RAG] Routing to GPT Master Orchestrator');
      
      const { data: orchestratorResponse, error: orchestratorError } = await supabaseClient.functions.invoke(
        'gpt-master-orchestrator',
        {
          body: {
            message,
            userId,
            threadId,
            conversationContext,
            userProfile: userProfile || {},
            queryPlan,
            optimizedParams: queryPlan.optimizedParams
          }
        }
      );

      if (orchestratorError) {
        console.error('[Chat-with-RAG] Orchestrator error:', orchestratorError);
        return await legacyProcessing(req, supabaseClient);
      }

      if (orchestratorResponse && orchestratorResponse.response) {
        // Cache the response
        EnhancedCacheManager.setCachedResponse(cacheKey, orchestratorResponse.response);
        
        console.log('[Chat-with-RAG] GPT orchestration successful');
        return new Response(JSON.stringify(orchestratorResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // For simple queries or fallback, use enhanced legacy processing
    console.log('[Chat-with-RAG] Using enhanced legacy processing');
    const response = await legacyProcessing(req, supabaseClient);
    
    // Cache successful responses
    const responseData = await response.json();
    if (responseData.response && !responseData.error) {
      EnhancedCacheManager.setCachedResponse(cacheKey, responseData.response);
    }
    
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-rag function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm sorry, I encountered an error while analyzing your journal entries. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function shouldUseGPTOrchestration(message: string, conversationContext: any[], queryPlan: any = {}): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Use complexity analysis if available
  if (queryPlan.complexityAnalysis) {
    return queryPlan.complexityAnalysis.complexityLevel === 'complex' || 
           queryPlan.complexityAnalysis.complexityLevel === 'very_complex';
  }
  
  // Fallback to pattern-based detection
  const complexPatterns = [
    /\b(analyze|analysis|pattern|trend|insight)\b/i,
    /\bhow (am|do) i\b/i,
    /\bwhy (do|am) i\b/i,
    /\bwhat (makes|causes) me\b/i,
    /\btop \d+\b/i,
    /\bmost (common|frequent)\b/i,
    /\b(compare|correlation|relationship)\b/i,
    /\b(over time|lately|recently|pattern)\b/i
  ];

  const personalPatterns = [
    /\b(i|me|my|myself)\b/i
  ];

  const emotionalPatterns = [
    /\b(feel|feeling|felt|emotion|mood|anxiety|depression|stress|happy|sad|angry)\b/i
  ];

  const isComplex = complexPatterns.some(pattern => pattern.test(lowerMessage));
  const isPersonal = personalPatterns.some(pattern => pattern.test(lowerMessage));
  const isEmotional = emotionalPatterns.some(pattern => pattern.test(lowerMessage));
  
  return isComplex || (isPersonal && isEmotional) || message.length > 50;
}

async function legacyProcessing(req: Request, supabaseClient: any) {
  const { processSubQueryWithEmotionSupport } = await import('./utils/enhancedSubQueryProcessor.ts');
  
  const body = await req.json();
  const { 
    message, 
    userId, 
    conversationContext = [], 
    queryPlan = {}
  } = body;

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Handle direct date queries
  if (queryPlan.isDirectDateQuery) {
    console.log('[Chat-with-RAG] Handling direct date query');
    return {
      response: queryPlan.dateResponse,
      analysis: {
        queryType: 'direct_date',
        timeRange: queryPlan.timeRange,
        cached: false
      }
    };
  }

  // Determine date range for analysis with optimizations
  let dateRange = null;
  if (queryPlan.timeRange && !body.useAllEntries) {
    dateRange = {
      startDate: queryPlan.timeRange.startDate,
      endDate: queryPlan.timeRange.endDate
    };
  }

  // Process with enhanced optimizations
  const subQueryResult = await processSubQueryWithEmotionSupport(
    message,
    supabaseClient,
    userId,
    dateRange,
    openaiApiKey,
    conversationContext,
    message,
    queryPlan.optimizedParams // Pass optimization parameters
  );

  if (subQueryResult.shouldStopProcessing && subQueryResult.noEntriesResponse) {
    return {
      response: subQueryResult.noEntriesResponse,
      analysis: {
        queryType: 'temporal_no_entries',
        dateRange: dateRange,
        reasoning: subQueryResult.reasoning,
        totalResults: 0,
        cached: false
      }
    };
  }

  if (subQueryResult.totalResults === 0) {
    return {
      response: "I don't have enough information in your journal entries to answer that question. Could you provide more details or try asking about something you've written about recently?",
      analysis: {
        queryType: 'insufficient_data',
        reasoning: subQueryResult.reasoning,
        totalResults: 0,
        cached: false
      }
    };
  }

  // Generate AI response using the found context
  const systemPrompt = `You are SOULo, an AI mental health therapist assistant that analyzes personal journal entries.

JOURNAL CONTEXT:
${subQueryResult.context}

ANALYSIS METADATA:
- Total relevant entries: ${subQueryResult.totalResults}
- Emotion analysis results: ${subQueryResult.emotionResults.length}
- Vector search results: ${subQueryResult.vectorResults.length}
- Reasoning: ${subQueryResult.reasoning}

Guidelines:
- Be personal and supportive in your response
- Reference specific insights from their journal entries
- Provide actionable advice when appropriate
- Keep responses concise but meaningful (2-3 paragraphs max)
- Don't mention technical details about the analysis process`;

  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 800
    }),
  });

  if (!aiResponse.ok) {
    throw new Error(`OpenAI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const response = aiData.choices[0].message.content;

  return {
    response,
    analysis: {
      queryType: 'legacy_processing_optimized',
      totalResults: subQueryResult.totalResults,
      emotionResults: subQueryResult.emotionResults.length,
      vectorResults: subQueryResult.vectorResults.length,
      reasoning: subQueryResult.reasoning,
      dateRange: dateRange,
      cached: false,
      optimizations: queryPlan.optimizedParams || {}
    },
    references: subQueryResult.vectorResults.slice(0, 3)
  };
}
