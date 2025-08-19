import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';

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

    console.log('[GPT Search Orchestrator] Executing plan with enhanced theme and entity filtering:', queryPlan.strategy);

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
        schemaAware: true,
        enhancedThemeFiltering: true,
        enhancedEntityFiltering: true
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
  console.log(`[Search Orchestrator] Executing ${method} with enhanced array-based filtering and entity-emotion analysis`);

  switch (method) {
    case 'vector_search':
      return await executeVectorSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'emotion_analysis':
      return await executeEmotionSearch(query, queryPlan, userId, supabase);
    
    case 'temporal_search':
      return await executeTemporalSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'theme_search':
      return await executeEnhancedThemeSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'entity_search':
      return await executeEnhancedEntitySearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'entity_emotion_search':
      return await executeEntityEmotionSearch(query, queryPlan, userId, supabase, openaiApiKey);
    
    case 'aggregation_search':
      return await executeAggregationSearch(query, queryPlan, userId, supabase);

    case 'temporal_stats':
      return await executeTemporalStats(query, queryPlan, userId, supabase);
    
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
    entities: result.entities || {},
    created_at: result.created_at
  }));

  return {
    method: 'vector_search',
    results: processedResults,
    confidence: 0.8,
    reasoning: 'Semantic similarity search based on query embedding with schema-aware content prioritization',
    schemaUtilization: 'Used refined text, transcription text, emotions, master_themes, and entities columns'
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
    entities: result.entities || {},
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
    entities: result.entities || {},
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

async function executeEnhancedThemeSearch(
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

  console.log('[Enhanced Theme Search] Using array-based filtering for themes:', queryPlan.filters.themes);

  // Use the new enhanced array-based theme search function
  const { data, error } = await supabase.rpc(
    'match_journal_entries_by_theme_array',
    {
      theme_queries: queryPlan.filters.themes,
      user_id_filter: userId,
      match_threshold: 0.3,
      match_count: 15,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null
    }
  );

  if (error) {
    console.error('[Enhanced Theme Search] Error:', error);
    throw error;
  }

  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    entities: result.entities || {},
    created_at: result.created_at,
    similarity: result.similarity,
    theme_matches: result.theme_matches || []
  }));

  console.log(`[Enhanced Theme Search] Found ${processedResults.length} entries with array-based filtering`);

  return {
    method: 'theme_search',
    results: processedResults,
    confidence: 0.9,
    reasoning: `Enhanced array-based theme search with PostgreSQL operators for themes: ${queryPlan.filters.themes.join(', ')}`,
    schemaUtilization: `Utilized master_themes array column with GIN index for optimized array operations and exact matching`
  };
}

async function executeEnhancedEntitySearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any,
  openaiApiKey: string
): Promise<SearchResult> {
  if (!queryPlan.filters?.entities || queryPlan.filters.entities.length === 0) {
    return {
      method: 'entity_search',
      results: [],
      confidence: 0,
      reasoning: 'No specific entities identified',
      schemaUtilization: 'Attempted to use entities JSONB but no target entities specified'
    };
  }

  console.log('[Enhanced Entity Search] Using array-based filtering for entities:', queryPlan.filters.entities);

  // Use the new enhanced array-based entity search function
  const { data, error } = await supabase.rpc(
    'match_journal_entries_by_entities',
    {
      entity_queries: queryPlan.filters.entities,
      user_id_filter: userId,
      match_threshold: 0.3,
      match_count: 15,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null
    }
  );

  if (error) {
    console.error('[Enhanced Entity Search] Error:', error);
    throw error;
  }

  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    entities: result.entities || {},
    created_at: result.created_at,
    similarity: result.similarity,
    entity_matches: result.entity_matches || {}
  }));

  console.log(`[Enhanced Entity Search] Found ${processedResults.length} entries with array-based entity filtering`);

  return {
    method: 'entity_search',
    results: processedResults,
    confidence: 0.9,
    reasoning: `Enhanced array-based entity search with PostgreSQL JSONB operators for entities: ${queryPlan.filters.entities.join(', ')}`,
    schemaUtilization: `Utilized entities JSONB column with optimized JSONB operations for exact entity matching`
  };
}

async function executeEntityEmotionSearch(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any,
  openaiApiKey: string
): Promise<SearchResult> {
  if (!queryPlan.filters?.entities || queryPlan.filters.entities.length === 0 ||
      !queryPlan.filters?.emotions || queryPlan.filters.emotions.length === 0) {
    return {
      method: 'entity_emotion_search',
      results: [],
      confidence: 0,
      reasoning: 'No specific entities or emotions identified for relationship analysis',
      schemaUtilization: 'Attempted to use entity-emotion relationships but insufficient parameters'
    };
  }

  console.log('[Entity-Emotion Search] Analyzing relationships for entities:', queryPlan.filters.entities);
  console.log('[Entity-Emotion Search] Analyzing relationships for emotions:', queryPlan.filters.emotions);

  // Use the new entity-emotion relationship search function
  const { data, error } = await supabase.rpc(
    'match_journal_entries_by_entity_emotion',
    {
      entity_queries: queryPlan.filters.entities,
      emotion_queries: queryPlan.filters.emotions,
      user_id_filter: userId,
      match_threshold: 0.3,
      match_count: 15,
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null
    }
  );

  if (error) {
    console.error('[Entity-Emotion Search] Error:', error);
    throw error;
  }

  const processedResults = (data || []).map((result: any) => ({
    ...result,
    content: result.content || result["refined text"] || result["transcription text"] || "",
    emotions: result.emotions || {},
    master_themes: result.themes || result.master_themes || [],
    entities: result.entities || {},
    entityemotion: result.entityemotion || {},
    created_at: result.created_at,
    similarity: result.similarity,
    entity_emotion_matches: result.entity_emotion_matches || {},
    relationship_strength: result.relationship_strength || 0
  }));

  console.log(`[Entity-Emotion Search] Found ${processedResults.length} entries with entity-emotion relationships`);

  return {
    method: 'entity_emotion_search',
    results: processedResults,
    confidence: 0.95,
    reasoning: `Advanced entity-emotion relationship analysis for entities: ${queryPlan.filters.entities.join(', ')} and emotions: ${queryPlan.filters.emotions.join(', ')}`,
    schemaUtilization: `Utilized entities, emotions, and entityemotion JSONB columns with specialized relationship analysis algorithms`
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

async function executeTemporalStats(
  query: string,
  queryPlan: any,
  userId: string,
  supabase: any
): Promise<SearchResult> {
  // Determine user timezone from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('[Temporal Stats] Could not fetch user profile timezone, defaulting to UTC:', profileError);
  }

  // Import and use timezone normalization
  const { normalizeUserTimezone } = await import('../_shared/timezoneUtils.ts');

  const timezone = normalizeUserTimezone(profile);

  const { data, error } = await supabase.rpc(
    'get_time_of_day_distribution',
    {
      start_date: queryPlan.filters?.timeRange?.startDate || null,
      end_date: queryPlan.filters?.timeRange?.endDate || null,
      user_timezone: timezone
    }
  );

  if (error) throw error;

  return {
    method: 'temporal_stats',
    results: data || [],
    confidence: 0.9,
    reasoning: `Calculated time-of-day distribution (${timezone}) with optional date filters`,
    schemaUtilization: 'Used created_at with timezone bucketing via get_time_of_day_distribution'
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
    
    // Extra boost for theme matches in enhanced theme search
    if (item.theme_matches && item.theme_matches.length > 0) {
      item.combinedConfidence *= 1.3;
    }
    
    // Extra boost for entity matches in enhanced entity search
    if (item.entity_matches && Object.keys(item.entity_matches).length > 0) {
      item.combinedConfidence *= 1.3;
    }
    
    // NEW: Highest boost for entity-emotion relationships
    if (item.entity_emotion_matches && item.relationship_strength > 0) {
      item.combinedConfidence *= 1.5;
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
