import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { generateDatabaseSchemaContext } from '../_shared/databaseSchemaContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  method: string;
  results: any[];
  confidence: number;
  reasoning: string;
  schemaUtilization: string;
}

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

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { queryPlan, originalQuery, userId } = await req.json();

    console.log('[GPT Search Orchestrator] Executing plan with database schema awareness:', queryPlan.strategy);

    // Execute search methods based on the intelligent plan
    const searchResults: SearchResult[] = [];

    for (const method of queryPlan.searchMethods) {
      try {
        const result = await executeSearchMethod(
          method,
          originalQuery,
          queryPlan,
          userId,
          supabaseClient,
          openaiApiKey
        );
        searchResults.push(result);
      } catch (error) {
        console.error(`Error executing ${method}:`, error);
        searchResults.push({
          method,
          results: [],
          confidence: 0,
          reasoning: `Error: ${error.message}`,
          schemaUtilization: "Failed to utilize schema due to error"
        });
      }
    }

    // Intelligently combine and rank results with schema awareness
    const combinedResults = await intelligentResultCombination(
      searchResults,
      queryPlan,
      originalQuery,
      openaiApiKey
    );

    return new Response(JSON.stringify({
      searchResults,
      combinedResults,
      executionSummary: {
        methodsUsed: queryPlan.searchMethods,
        totalResults: combinedResults.length,
        confidence: queryPlan.confidence,
        schemaAware: true
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT search orchestrator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      searchResults: [],
      combinedResults: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeSearchMethod(
  method: string,
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any,
  openaiApiKey: string
): Promise<SearchResult> {
  console.log(`[Search Orchestrator] Executing ${method} with schema awareness`);

  switch (method) {
    case 'vector_search':
      return await executeVectorSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'emotion_analysis':
      return await executeEmotionSearch(query, queryPlan, userId, supabase);
    
    case 'temporal_search':
      return await executeTemporalSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'theme_search':
      return await executeThemeSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'aggregation_search':
      return await executeAggregationSearch(query, queryPlan, userId, supabase);
    
    default:
      throw new Error(`Unknown search method: ${method}`);
  }
}

async function executeVectorSearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any,
  openaiApiKey: string
): Promise<SearchResult> {
  // Generate embedding for the query
  const embedding = await generateEmbedding(query, openaiApiKey);
  
  const { data, error } = await supabase.rpc(
    'match_journal_entries_with_date',
    {
      query_embedding: embedding,
      match_threshold: 0.1,
      match_count: 15,
      user_id_filter: userId,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null
    }
  );

  if (error) throw error;

  // Ensure we're getting the right content fields
  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    created_at: result.created_at
  }));

  return {
    method: 'vector_search',
    results: processedResults,
    confidence: 0.8,
    reasoning: 'Semantic similarity search based on query embedding with schema-aware content prioritization',
    schemaUtilization: 'Used refined text, transcription text, emotions, and master_themes columns'
  };
}

async function executeEmotionSearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any
): Promise<SearchResult> {
  if (!queryPlan.emotionFocus && !queryPlan.filters?.emotionFocus) {
    return {
      method: 'emotion_analysis',
      results: [],
      confidence: 0,
      reasoning: 'No specific emotion detected in query',
      schemaUtilization: 'Attempted to analyze emotions column but no target emotion specified'
    };
  }

  const emotionTarget = queryPlan.emotionFocus || queryPlan.filters?.emotionFocus;

  const { data, error } = await supabase.rpc(
    'match_journal_entries_by_emotion_strength',
    {
      emotion_name: emotionTarget,
      user_id_filter: userId,
      match_count: 10,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null
    }
  );

  if (error) throw error;

  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    emotion_score: result.emotion_score,
    created_at: result.created_at
  }));

  return {
    method: 'emotion_analysis',
    results: processedResults,
    confidence: 0.9,
    reasoning: `Focused search for ${emotionTarget} emotion patterns using pre-calculated scores`,
    schemaUtilization: `Utilized emotions JSONB column with numerical scores for ${emotionTarget}`
  };
}

async function executeTemporalSearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any,
  openaiApiKey: string
): Promise<SearchResult> {
  if (!queryPlan.filters?.timeRange) {
    return {
      method: 'temporal_search',
      results: [],
      confidence: 0,
      reasoning: 'No specific time range identified',
      schemaUtilization: 'Attempted to use created_at column but no time range specified'
    };
  }

  // Get entries within the time range and then do semantic search
  const embedding = await generateEmbedding(query, openaiApiKey);
  
  const { data, error } = await supabase.rpc(
    'match_journal_entries_with_date',
    {
      query_embedding: embedding,
      match_threshold: 0.05,
      match_count: 20,
      user_id_filter: userId,
      start_date: queryPlan.filters.timeRange.startDate,
      end_date: queryPlan.filters.timeRange.endDate
    }
  );

  if (error) throw error;

  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    created_at: result.created_at
  }));

  return {
    method: 'temporal_search',
    results: processedResults,
    confidence: 0.85,
    reasoning: `Time-constrained search for period: ${queryPlan.filters.timeRange.startDate} to ${queryPlan.filters.timeRange.endDate}`,
    schemaUtilization: 'Used created_at column for temporal filtering with semantic search'
  };
}

async function executeThemeSearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any,
  openaiApiKey: string
): Promise<SearchResult> {
  if (!queryPlan.filters?.themes || queryPlan.filters.themes.length === 0) {
    return {
      method: 'theme_search',
      results: [],
      confidence: 0,
      reasoning: 'No specific themes identified',
      schemaUtilization: 'Attempted to use master_themes array but no target themes specified'
    };
  }

  // Use theme-based search function
  const theme = queryPlan.filters.themes[0]; // Use first theme
  const { data, error } = await supabase.rpc(
    'match_journal_entries_by_theme',
    {
      theme_query: theme,
      user_id_filter: userId,
      match_threshold: 0.3,
      match_count: 10,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null
    }
  );

  if (error) throw error;

  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    created_at: result.created_at,
    similarity: result.similarity
  }));

  return {
    method: 'theme_search',
    results: processedResults,
    confidence: 0.75,
    reasoning: `Theme-based search focusing on: ${theme}`,
    schemaUtilization: `Utilized master_themes array column for categorization matching`
  };
}

async function executeAggregationSearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any
): Promise<SearchResult> {
  // Get aggregated emotional data
  const { data, error } = await supabase.rpc(
    'get_top_emotions_with_entries',
    {
      user_id_param: userId,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null,
      limit_count: 5
    }
  );

  if (error) throw error;

  return {
    method: 'aggregation_search',
    results: data || [],
    confidence: 0.9,
    reasoning: 'Statistical analysis of emotional patterns and top emotions using aggregated data',
    schemaUtilization: 'Used emotions JSONB column for statistical aggregation with sample entries'
  };
}

async function intelligentResultCombination(
  searchResults: SearchResult[],
  queryPlan: any,
  originalQuery: string,
  openaiApiKey: string
): Promise<any[]> {
  // Combine all results with intelligent deduplication and ranking
  const allResults = new Map();
  
  searchResults.forEach(result => {
    result.results.forEach(item => {
      const key = item.id || item.entry_id || `${item.content?.substring(0, 50)}`;
      if (!allResults.has(key)) {
        allResults.set(key, {
          ...item,
          searchMethods: [result.method],
          combinedConfidence: result.confidence,
          schemaUtilization: [result.schemaUtilization]
        });
      } else {
        const existing = allResults.get(key);
        existing.searchMethods.push(result.method);
        existing.combinedConfidence = Math.max(existing.combinedConfidence, result.confidence);
        existing.schemaUtilization.push(result.schemaUtilization);
      }
    });
  });

  // Convert to array and sort by combined confidence and relevance
  const combinedArray = Array.from(allResults.values());
  
  // Boost items found by multiple methods
  combinedArray.forEach(item => {
    if (item.searchMethods.length > 1) {
      item.combinedConfidence *= 1.2;
    }
  });

  // Sort by combined confidence
  combinedArray.sort((a, b) => b.combinedConfidence - a.combinedConfidence);

  return combinedArray.slice(0, 15); // Return top 15 results
}

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}
