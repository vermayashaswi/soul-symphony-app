import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestrationResult {
  subQuestions: any[];
  queryPlans: any[];
  selections: any;
  searchResults: any[];
  response: string;
  metadata: {
    totalLatency: number;
    cacheHits: number;
    fallbacksUsed: string[];
    qualityScore: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { userMessage, threadId, userId, conversationContext = [] } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    console.log('Starting enhanced RAG orchestration for user:', userId);

    // Step 1: Generate Sub-Questions using GPT
    console.log('Step 1: Generating sub-questions...');
    const subQuestionResponse = await supabase.functions.invoke('gpt-sub-question-generator', {
      body: {
        userMessage,
        conversationContext,
        userPatterns: {} // TODO: Get from user profile
      }
    });

    const subQuestions = subQuestionResponse.data?.subQuestions || [];
    console.log(`Generated ${subQuestions.length} sub-questions`);

    // Step 2: Create Query Plans using GPT
    console.log('Step 2: Creating query plans...');
    const queryPlanResponse = await supabase.functions.invoke('gpt-query-planner', {
      body: {
        subQuestions,
        userContext: { userId, threadId },
        performanceConstraints: { maxLatency: 8000, maxParallel: 3 }
      }
    });

    const queryPlans = queryPlanResponse.data?.queryPlans || [];
    console.log(`Created ${queryPlans.length} query plans`);

    // Step 3: Select Themes/Emotions using GPT
    console.log('Step 3: Selecting themes and emotions...');
    const selectionResponse = await supabase.functions.invoke('gpt-theme-emotion-selector', {
      body: {
        subQuestions,
        userQuery: userMessage,
        userContext: { userId, threadId }
      }
    });

    const selections = selectionResponse.data?.selections || { themes: [], emotions: [], entities: [] };
    console.log(`Selected ${selections.themes.length} themes, ${selections.emotions.length} emotions`);

    // Step 4: Execute Search Queries
    console.log('Step 4: Executing search queries...');
    const searchResults = await executeSearchQueries(queryPlans, selections, userId, supabase);

    // Step 5: Generate Enhanced Response
    console.log('Step 5: Generating enhanced response...');
    const responseResult = await generateEnhancedResponse(
      userMessage,
      subQuestions,
      searchResults,
      selections,
      conversationContext,
      supabase
    );

    // Step 6: Store Results and Update Thread
    const totalLatency = Date.now() - startTime;
    console.log(`Total orchestration completed in ${totalLatency}ms`);

    // Save message to thread
    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender: 'user',
      content: userMessage,
      role: 'user'
    });

    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender: 'assistant',
      content: responseResult.response,
      role: 'assistant',
      analysis_data: {
        subQuestions,
        queryPlans,
        selections,
        searchResults: searchResults.map(sr => ({
          ...sr,
          entries: sr.entries?.slice(0, 3) // Limit stored entries
        }))
      }
    });

    const result: OrchestrationResult = {
      subQuestions,
      queryPlans,
      selections,
      searchResults,
      response: responseResult.response,
      metadata: {
        totalLatency,
        cacheHits: 0, // TODO: Implement caching
        fallbacksUsed: responseResult.fallbacksUsed || [],
        qualityScore: responseResult.qualityScore || 0.8
      }
    };

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced-rag-orchestrator:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallbackResponse: "I encountered an issue processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeSearchQueries(queryPlans: any[], selections: any, userId: string, supabase: any) {
  const searchResults = [];

  for (const plan of queryPlans) {
    try {
      let result;
      
      switch (plan.searchMethod) {
        case 'vector_similarity':
          result = await executeVectorSearch(plan, userId, supabase);
          break;
        case 'sql_query':
          result = await executeSQLSearch(plan, selections, userId, supabase);
          break;
        case 'hybrid_search':
          result = await executeHybridSearch(plan, selections, userId, supabase);
          break;
        case 'emotion_analysis':
          result = await executeEmotionSearch(plan, selections, userId, supabase);
          break;
        default:
          result = await executeFallbackSearch(plan, userId, supabase);
      }

      searchResults.push({
        planId: plan.subQuestionId,
        method: plan.searchMethod,
        entries: result.entries || [],
        metadata: result.metadata || {}
      });

    } catch (error) {
      console.error(`Search error for plan ${plan.subQuestionId}:`, error);
      searchResults.push({
        planId: plan.subQuestionId,
        method: 'fallback',
        entries: [],
        error: error.message
      });
    }
  }

  return searchResults;
}

async function executeVectorSearch(plan: any, userId: string, supabase: any) {
  // Use existing vector search functionality
  const { data, error } = await supabase.rpc('match_journal_entries_with_date', {
    query_embedding: `[${Array(1536).fill(0).join(',')}]`, // Placeholder
    match_threshold: plan.parameters.vectorThreshold || 0.7,
    match_count: plan.parameters.maxResults || 10,
    user_id_filter: userId,
    start_date: plan.parameters.timeFilter?.start,
    end_date: plan.parameters.timeFilter?.end
  });

  return { entries: data || [], metadata: { method: 'vector', error } };
}

async function executeSQLSearch(plan: any, selections: any, userId: string, supabase: any) {
  let query = supabase.from('Journal Entries')
    .select('*')
    .eq('user_id', userId)
    .limit(plan.parameters.maxResults || 10);

  if (plan.parameters.timeFilter?.start) {
    query = query.gte('created_at', plan.parameters.timeFilter.start);
  }
  if (plan.parameters.timeFilter?.end) {
    query = query.lte('created_at', plan.parameters.timeFilter.end);
  }

  const { data, error } = await query;
  return { entries: data || [], metadata: { method: 'sql', error } };
}

async function executeHybridSearch(plan: any, selections: any, userId: string, supabase: any) {
  // Combine vector and SQL results
  const [vectorResult, sqlResult] = await Promise.all([
    executeVectorSearch(plan, userId, supabase),
    executeSQLSearch(plan, selections, userId, supabase)
  ]);

  const combinedEntries = [
    ...(vectorResult.entries || []),
    ...(sqlResult.entries || [])
  ].slice(0, plan.parameters.maxResults || 10);

  return { entries: combinedEntries, metadata: { method: 'hybrid' } };
}

async function executeEmotionSearch(plan: any, selections: any, userId: string, supabase: any) {
  if (!selections.emotions?.length) {
    return { entries: [], metadata: { method: 'emotion', note: 'No emotions selected' } };
  }

  const emotion = selections.emotions[0].name;
  const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
    emotion_name: emotion,
    user_id_filter: userId,
    min_score: 0.3,
    start_date: plan.parameters.timeFilter?.start,
    end_date: plan.parameters.timeFilter?.end,
    limit_count: plan.parameters.maxResults || 5
  });

  return { entries: data || [], metadata: { method: 'emotion', emotion, error } };
}

async function executeFallbackSearch(plan: any, userId: string, supabase: any) {
  const { data, error } = await supabase
    .from('Journal Entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  return { entries: data || [], metadata: { method: 'fallback', error } };
}

async function generateEnhancedResponse(
  userMessage: string,
  subQuestions: any[],
  searchResults: any[],
  selections: any,
  conversationContext: any[],
  supabase: any
) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `You are SOULo, a warm and insightful wellness coach. You help users understand their thoughts, emotions, and personal growth through their journal entries.

ANALYSIS CONTEXT:
- Sub-questions explored: ${subQuestions.map(sq => sq.question).join('; ')}
- Relevant themes: ${selections.themes?.map((t: any) => t.name).join(', ') || 'none'}
- Relevant emotions: ${selections.emotions?.map((e: any) => e.name).join(', ') || 'none'}
- Search results: ${searchResults.length} result sets

RESPONSE GUIDELINES:
1. Be warm, supportive, and insightful
2. Reference specific journal entries when relevant
3. Highlight patterns and growth opportunities
4. Provide actionable insights
5. Use the sub-question analysis to structure your response
6. Be concise but thorough (aim for 2-3 paragraphs)

Your response should feel personal and helpful, drawing from their actual journal content.`;

  const formattedResults = searchResults.map((result, index) => {
    const question = subQuestions[index]?.question || `Search ${index + 1}`;
    const entries = result.entries?.slice(0, 3) || [];
    return `
Question: ${question}
Entries found: ${entries.length}
Sample content: ${entries.map((e: any) => 
  (e['refined text'] || e['transcription text'] || '').slice(0, 150)
).join(' | ')}`;
  }).join('\n');

  const userPrompt = `
User Query: "${userMessage}"

Search Results:
${formattedResults}

Recent Conversation: ${JSON.stringify(conversationContext.slice(-2))}

Provide a warm, insightful response that addresses the user's query using the search results and analysis.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      }),
    });

    const data = await response.json();
    const generatedResponse = data.choices[0]?.message?.content || 
      "I've analyzed your journal entries and found some interesting patterns, though I'm having trouble generating a detailed response right now.";

    return {
      response: generatedResponse,
      qualityScore: 0.9,
      fallbacksUsed: []
    };

  } catch (error) {
    console.error('Response generation error:', error);
    return {
      response: "I've found some relevant entries in your journal that relate to your question. While I can't provide a detailed analysis right now, I encourage you to reflect on the patterns and themes in your recent entries.",
      qualityScore: 0.5,
      fallbacksUsed: ['response_generation']
    };
  }
}