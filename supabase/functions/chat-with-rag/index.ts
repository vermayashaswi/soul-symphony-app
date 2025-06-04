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

    console.log(`[Chat-with-RAG] Processing with GPT Intelligence: "${message}"`);

    // Get user profile for intelligent processing
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('timezone, subscription_status, journal_focus_areas')
      .eq('id', userId)
      .single();

    // Check if this should use the new intelligent orchestration
    const shouldUseIntelligentOrchestration = shouldUseGPTOrchestration(message, conversationContext);

    if (shouldUseIntelligentOrchestration) {
      console.log('[Chat-with-RAG] Routing to GPT Master Orchestrator');
      
      // Route to the new intelligent orchestration system
      const { data: orchestratorResponse, error: orchestratorError } = await supabaseClient.functions.invoke(
        'gpt-master-orchestrator',
        {
          body: {
            message,
            userId,
            threadId,
            conversationContext,
            userProfile: userProfile || {}
          }
        }
      );

      if (orchestratorError) {
        console.error('[Chat-with-RAG] Orchestrator error:', orchestratorError);
        // Fall back to legacy processing
        return await legacyProcessing(req, supabaseClient);
      }

      if (orchestratorResponse) {
        console.log('[Chat-with-RAG] GPT orchestration successful');
        return new Response(JSON.stringify(orchestratorResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // For simple queries or fallback, use enhanced legacy processing
    console.log('[Chat-with-RAG] Using enhanced legacy processing');
    return await legacyProcessing(req, supabaseClient);

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

function shouldUseGPTOrchestration(message: string, conversationContext: any[]): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Use GPT orchestration for complex queries
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

  // Use for personal insight queries
  const personalPatterns = [
    /\b(i|me|my|myself)\b/i
  ];

  // Use for emotional queries
  const emotionalPatterns = [
    /\b(feel|feeling|felt|emotion|mood|anxiety|depression|stress|happy|sad|angry)\b/i
  ];

  const isComplex = complexPatterns.some(pattern => pattern.test(lowerMessage));
  const isPersonal = personalPatterns.some(pattern => pattern.test(lowerMessage));
  const isEmotional = emotionalPatterns.some(pattern => pattern.test(lowerMessage));
  
  // Use GPT orchestration for complex, personal, or emotional queries
  return isComplex || (isPersonal && isEmotional) || message.length > 50;
}

async function legacyProcessing(req: Request, supabaseClient: any) {
  // Keep existing legacy processing logic as fallback
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
    return new Response(JSON.stringify({
      response: queryPlan.dateResponse,
      analysis: {
        queryType: 'direct_date',
        timeRange: queryPlan.timeRange
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Determine date range for analysis
  let dateRange = null;
  if (queryPlan.timeRange && !body.useAllEntries) {
    dateRange = {
      startDate: queryPlan.timeRange.startDate,
      endDate: queryPlan.timeRange.endDate
    };
  }

  // Process the query with enhanced validation
  const subQueryResult = await processSubQueryWithEmotionSupport(
    message,
    supabaseClient,
    userId,
    dateRange,
    openaiApiKey,
    conversationContext,
    message
  );

  if (subQueryResult.shouldStopProcessing && subQueryResult.noEntriesResponse) {
    return new Response(JSON.stringify({
      response: subQueryResult.noEntriesResponse,
      analysis: {
        queryType: 'temporal_no_entries',
        dateRange: dateRange,
        reasoning: subQueryResult.reasoning,
        totalResults: 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (subQueryResult.totalResults === 0) {
    return new Response(JSON.stringify({
      response: "I don't have enough information in your journal entries to answer that question. Could you provide more details or try asking about something you've written about recently?",
      analysis: {
        queryType: 'insufficient_data',
        reasoning: subQueryResult.reasoning,
        totalResults: 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

  return new Response(JSON.stringify({
    response,
    analysis: {
      queryType: 'legacy_processing',
      totalResults: subQueryResult.totalResults,
      emotionResults: subQueryResult.emotionResults.length,
      vectorResults: subQueryResult.vectorResults.length,
      reasoning: subQueryResult.reasoning,
      dateRange: dateRange
    },
    references: subQueryResult.vectorResults.slice(0, 3)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
