
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

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      queryPlan,
      originalQuery,
      userId 
    } = await req.json();

    console.log(`[GPT Search Orchestrator] Executing search plan for: "${originalQuery}"`);

    let searchResults = [];
    let executionLog = [];

    // Execute primary search based on plan
    const primarySearch = queryPlan.searchPlan.primarySearch;
    
    if (primarySearch.method === 'vector' || primarySearch.method === 'hybrid') {
      executionLog.push('Executing vector similarity search...');
      
      // Generate embedding for the query
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: originalQuery
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;

        // Execute vector search with date filtering if specified
        const vectorResults = await executeVectorSearch(
          supabaseClient,
          queryEmbedding,
          primarySearch.parameters,
          userId
        );
        
        searchResults.push(...vectorResults);
        executionLog.push(`Vector search returned ${vectorResults.length} results`);
      }
    }

    // Execute emotion-based search if specified
    if (primarySearch.method === 'emotion' || primarySearch.method === 'hybrid') {
      if (primarySearch.parameters.emotionFilters?.length > 0) {
        executionLog.push('Executing emotion-based search...');
        
        for (const emotion of primarySearch.parameters.emotionFilters) {
          const emotionResults = await executeEmotionSearch(
            supabaseClient,
            emotion,
            primarySearch.parameters,
            userId
          );
          searchResults.push(...emotionResults);
        }
        executionLog.push(`Emotion search completed for ${primarySearch.parameters.emotionFilters.length} emotions`);
      }
    }

    // Execute secondary searches
    for (const secondarySearch of queryPlan.searchPlan.secondarySearches || []) {
      executionLog.push(`Executing secondary search: ${secondarySearch.purpose}`);
      // Implementation would depend on the specific secondary search type
    }

    // Execute aggregations
    let aggregationResults = {};
    for (const aggregation of queryPlan.searchPlan.aggregations || []) {
      executionLog.push(`Executing aggregation: ${aggregation.type}`);
      
      if (aggregation.type === 'emotion_summary') {
        const emotionSummary = await executeEmotionSummary(supabaseClient, userId, primarySearch.parameters);
        aggregationResults.emotionSummary = emotionSummary;
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = removeDuplicates(searchResults);
    const sortedResults = sortByRelevance(uniqueResults);

    console.log(`[GPT Search Orchestrator] Search completed: ${sortedResults.length} unique results`);

    return new Response(JSON.stringify({
      results: sortedResults.slice(0, primarySearch.parameters.maxResults || 10),
      aggregations: aggregationResults,
      executionLog,
      totalResults: sortedResults.length,
      strategy: queryPlan.strategy
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-search-orchestrator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      results: [],
      executionLog: [`Error: ${error.message}`]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeVectorSearch(supabase: any, embedding: number[], parameters: any, userId: string) {
  try {
    let query = supabase.rpc('match_journal_entries_fixed', {
      query_embedding: embedding,
      match_threshold: parameters.vectorThreshold,
      match_count: parameters.maxResults || 10,
      user_id_filter: userId
    });

    // Apply date filtering if specified
    if (parameters.dateRange) {
      query = supabase.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: parameters.vectorThreshold,
        match_count: parameters.maxResults || 10,
        user_id_filter: userId,
        start_date: parameters.dateRange.startDate,
        end_date: parameters.dateRange.endDate
      });
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Vector search execution error:', error);
    return [];
  }
}

async function executeEmotionSearch(supabase: any, emotion: string, parameters: any, userId: string) {
  try {
    const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
      emotion_name: emotion,
      user_id_filter: userId,
      min_score: 0.3,
      start_date: parameters.dateRange?.startDate || null,
      end_date: parameters.dateRange?.endDate || null,
      limit_count: Math.floor((parameters.maxResults || 10) / 2)
    });

    if (error) {
      console.error('Emotion search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Emotion search execution error:', error);
    return [];
  }
}

async function executeEmotionSummary(supabase: any, userId: string, parameters: any) {
  try {
    const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
      user_id_param: userId,
      start_date: parameters.dateRange?.startDate || null,
      end_date: parameters.dateRange?.endDate || null,
      limit_count: 5
    });

    if (error) {
      console.error('Emotion summary error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Emotion summary execution error:', error);
    return null;
  }
}

function removeDuplicates(results: any[]) {
  const seen = new Set();
  return results.filter(result => {
    const key = result.id || result.journal_entry_id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sortByRelevance(results: any[]) {
  return results.sort((a, b) => {
    const aScore = a.similarity || a.emotion_score || 0;
    const bScore = b.similarity || b.emotion_score || 0;
    return bScore - aScore;
  });
}
