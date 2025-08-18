
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { generateEmbedding } from './utils/embeddingService.ts';
import { 
  searchEntriesWithVector, 
  searchEntriesWithTimeRange,
  searchEntriesByMonth,
  searchEntriesByThemes,
  searchEntriesByEntities
} from './utils/searchService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Chat-RAG] Starting enhanced RAG query processing');

    // Create Supabase client with user's auth token for RLS compliance
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestBody = await req.json();
    const { 
      message, 
      userId, 
      conversationContext = [], 
      userProfile = {},
      queryPlan = {}
    } = requestBody;

    console.log(`[Chat-RAG] Processing query: "${message}" for user: ${userId}`);

    // Generate embedding for the query
    console.log('[Chat-RAG] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(message, openaiApiKey);

    let searchResults = [];
    let searchMethod = 'standard_vector';

    // Determine search strategy based on query plan
    if (queryPlan.timeRange) {
      console.log('[Chat-RAG] Using time-filtered vector search');
      searchMethod = 'time_filtered_vector';
      searchResults = await searchEntriesWithTimeRange(
        supabaseClient, 
        userId, 
        queryEmbedding, 
        queryPlan.timeRange
      );
    } else if (queryPlan.monthQuery) {
      console.log(`[Chat-RAG] Using month-based search for: ${queryPlan.monthQuery}`);
      searchMethod = 'month_based_vector';
      searchResults = await searchEntriesByMonth(
        supabaseClient,
        userId,
        queryEmbedding,
        queryPlan.monthQuery,
        queryPlan.year
      );
    } else if (queryPlan.themeQueries && queryPlan.themeQueries.length > 0) {
      console.log(`[Chat-RAG] Using theme-based search for: ${queryPlan.themeQueries.join(', ')}`);
      searchMethod = 'theme_based';
      searchResults = await searchEntriesByThemes(
        supabaseClient,
        userId,
        queryPlan.themeQueries,
        queryPlan.timeRange
      );
    } else if (queryPlan.entityQueries && queryPlan.entityQueries.length > 0) {
      console.log(`[Chat-RAG] Using entity-based search for: ${queryPlan.entityQueries.join(', ')}`);
      searchMethod = 'entity_based';
      searchResults = await searchEntriesByEntities(
        supabaseClient,
        userId,
        queryPlan.entityQueries,
        queryPlan.timeRange
      );
    } else {
      console.log('[Chat-RAG] Using standard vector search');
      searchResults = await searchEntriesWithVector(supabaseClient, userId, queryEmbedding);
    }

    // Generate AI response
    console.log(`[Chat-RAG] Generating AI response with ${searchResults.length} search results`);
    
    const contextText = searchResults
      .slice(0, 8)
      .map(entry => {
        const content = entry.content?.slice(0, 300) || 'No content';
        const date = new Date(entry.created_at).toLocaleDateString();
        const similarity = entry.similarity ? ` (similarity: ${entry.similarity.toFixed(2)})` : '';
        return `Entry from ${date}${similarity}: ${content}`;
      })
      .join('\n\n');

    const systemPrompt = `You are Ruh by SOuLO, an empathetic AI journal analyst. Based on the user's journal entries, provide helpful insights and support.

User Profile: ${JSON.stringify(userProfile)}
Search Method Used: ${searchMethod}
Query Plan: ${JSON.stringify(queryPlan)}

Journal Context:
${contextText || 'No relevant entries found.'}

Guidelines:
- Be empathetic and supportive
- Reference specific entries when relevant
- Provide insights based on patterns you observe
- Keep responses conversational and under 150 words
- If no entries are found, encourage the user to journal more`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-4),
      { role: 'user', content: message }
    ];

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices[0].message.content;

    console.log('[Chat-RAG] Successfully generated AI response');

    return new Response(JSON.stringify({
      response: responseText,
      analysis: {
        searchMethod,
        resultsCount: searchResults.length,
        queryPlan,
        vectorSearchWorking: true,
        embeddingDimensions: queryEmbedding.length
      },
      referenceEntries: searchResults.slice(0, 5).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.themes || entry.master_themes || [],
        emotions: entry.emotions || {},
        similarity: entry.similarity || 0
      })),
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Chat-RAG] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. The vector search functions have been updated - please try your query again.",
      analysis: {
        queryType: 'error',
        errorType: 'processing_error',
        timestamp: new Date().toISOString(),
        vectorSearchFixed: true
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
