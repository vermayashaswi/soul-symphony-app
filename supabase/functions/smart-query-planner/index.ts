
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueryPlan {
  strategy: string;
  complexity: 'simple' | 'complex' | 'multi_part';
  requiresTimeFilter: boolean;
  requiresAggregation: boolean;
  expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative';
  subQueries: string[];
  filters: {
    timeRange?: { startDate?: string; endDate?: string };
    themes?: string[];
    entities?: string[];
    emotions?: string[];
  };
  embeddingNeeded: boolean;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log(`[SmartQueryPlanner] Generating embedding for text: ${text.slice(0, 100)}...`);
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('[SmartQueryPlanner] Failed to generate embedding:', error);
      throw new Error('Could not generate embedding for the query');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Empty embedding data received from OpenAI');
    }

    const embedding = embeddingData.data[0].embedding;
    console.log(`[SmartQueryPlanner] Generated embedding with ${embedding.length} dimensions`);
    return embedding;
  } catch (error) {
    console.error('[SmartQueryPlanner] Error generating embedding:', error);
    throw error;
  }
}

function planQuery(message: string, timeRange?: any): QueryPlan {
  const lowerMessage = message.toLowerCase();
  console.log(`[SmartQueryPlanner] Planning query for: ${message}`);
  
  // Determine complexity
  let complexity: 'simple' | 'complex' | 'multi_part' = 'simple';
  
  const questionMarkers = (lowerMessage.match(/\?/g) || []).length;
  const andMarkers = (lowerMessage.match(/\band\b/g) || []).length;
  const alsoMarkers = (lowerMessage.match(/\balso\b/g) || []).length;
  
  if (questionMarkers > 1 || (andMarkers > 0 && (questionMarkers > 0 || alsoMarkers > 0))) {
    complexity = 'multi_part';
  } else if (/\b(pattern|trend|analysis|compare|correlation|top\s+\d+|most\s+(common|frequent)|when do|what time|how often|frequency|usually|typically)\b/i.test(lowerMessage)) {
    complexity = 'complex';
  }
  
  // Determine if time filtering is required
  const requiresTimeFilter = !!(timeRange || /\b(last|this|current|recent|past)\s+(week|month|year|day)\b/i.test(lowerMessage) || /\bin\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lowerMessage));
  
  // Determine if aggregation is required
  const requiresAggregation = /\b(top\s+\d+|most\s+(common|frequent)|average|total|sum|count|how\s+many|how\s+often|when do|what time|frequency|usually|typically|pattern|trend)\b/i.test(lowerMessage);
  
  // Extract time range information
  let timeFilters: { startDate?: string; endDate?: string } | undefined;
  if (requiresTimeFilter) {
    // Extract month references
    const monthMatch = lowerMessage.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
    if (monthMatch) {
      const monthName = monthMatch[0];
      const currentYear = new Date().getFullYear();
      const monthIndex = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(monthName.toLowerCase());
      
      if (monthIndex !== -1) {
        const startDate = new Date(currentYear, monthIndex, 1);
        const endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
        timeFilters = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        };
      }
    }
    // Add other time range extraction logic as needed
  }
  
  // Extract themes, entities, emotions from the message
  const themes: string[] = [];
  const entities: string[] = [];
  const emotions: string[] = [];
  
  // Extract emotional keywords
  const emotionKeywords = ['happy', 'sad', 'angry', 'excited', 'anxious', 'stressed', 'calm', 'peaceful', 'frustrated', 'joy', 'fear', 'love', 'hope', 'worry', 'confidence', 'doubt'];
  emotionKeywords.forEach(emotion => {
    if (lowerMessage.includes(emotion)) {
      emotions.push(emotion);
    }
  });
  
  // Extract common entities (people, places, activities)
  const commonEntities = ['work', 'family', 'friends', 'home', 'travel', 'exercise', 'music', 'food', 'sleep', 'health'];
  commonEntities.forEach(entity => {
    if (lowerMessage.includes(entity)) {
      entities.push(entity);
    }
  });
  
  // Generate sub-queries for complex queries
  const subQueries: string[] = [];
  if (complexity === 'multi_part') {
    // Split complex queries into sub-queries
    const parts = message.split(/\band\b|\?/i).filter(part => part.trim().length > 0);
    subQueries.push(...parts.map(part => part.trim()));
  } else {
    subQueries.push(message);
  }
  
  // Determine expected response type
  let expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative' = 'narrative';
  
  if (/^(what\s+are\s+the\s+dates?|when\s+(is|was))\b/i.test(lowerMessage)) {
    expectedResponseType = 'direct';
  } else if (requiresAggregation || /\btop\s+\d+\b/i.test(lowerMessage) || /\b(when do|what time|how often|frequency|usually|typically)\b/i.test(lowerMessage)) {
    expectedResponseType = 'aggregated';
  } else if (/\b(analyze|analysis|insight|pattern|trend)\b/i.test(lowerMessage)) {
    expectedResponseType = 'analysis';
  }
  
  // Determine strategy
  let strategy = 'comprehensive';
  if (complexity === 'multi_part') {
    strategy = 'segmented_processing';
  } else if (expectedResponseType === 'aggregated') {
    strategy = 'data_aggregation';
  } else if (expectedResponseType === 'analysis') {
    strategy = 'pattern_analysis';
  } else if (requiresTimeFilter) {
    strategy = 'time_filtered_search';
  }
  
  console.log(`[SmartQueryPlanner] Generated query plan:`, {
    strategy,
    complexity,
    requiresTimeFilter,
    requiresAggregation,
    expectedResponseType,
    subQueryCount: subQueries.length,
    filtersCount: themes.length + entities.length + emotions.length
  });
  
  return {
    strategy,
    complexity,
    requiresTimeFilter,
    requiresAggregation,
    expectedResponseType,
    subQueries,
    filters: {
      timeRange: timeFilters,
      themes: themes.length > 0 ? themes : undefined,
      entities: entities.length > 0 ? entities : undefined,
      emotions: emotions.length > 0 ? emotions : undefined,
    },
    embeddingNeeded: true // Always generate embeddings for semantic search
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[SmartQueryPlanner] Received ${req.method} request`);
    
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, userId, timeRange } = await req.json();
    
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: message and userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SmartQueryPlanner] Processing query for user: ${userId}`);
    console.log(`[SmartQueryPlanner] Message: ${message}`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[SmartQueryPlanner] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate query plan
    const queryPlan = planQuery(message, timeRange);
    
    // Generate embedding for the main query for semantic search
    let queryEmbedding: number[] | null = null;
    try {
      if (queryPlan.embeddingNeeded) {
        queryEmbedding = await generateEmbedding(message, openaiApiKey);
      }
    } catch (error) {
      console.error('[SmartQueryPlanner] Failed to generate embedding, proceeding without semantic search:', error);
      // Continue without embedding - will rely on theme/entity search
    }

    // Generate embeddings for sub-queries if needed
    const subQueryEmbeddings: { [key: string]: number[] } = {};
    if (queryPlan.subQueries.length > 1) {
      console.log(`[SmartQueryPlanner] Generating embeddings for ${queryPlan.subQueries.length} sub-queries`);
      
      for (let i = 0; i < queryPlan.subQueries.length; i++) {
        const subQuery = queryPlan.subQueries[i];
        try {
          const embedding = await generateEmbedding(subQuery, openaiApiKey);
          subQueryEmbeddings[`subQuery${i + 1}`] = embedding;
          console.log(`[SmartQueryPlanner] Generated embedding for sub-query ${i + 1}: ${subQuery.slice(0, 50)}...`);
        } catch (error) {
          console.error(`[SmartQueryPlanner] Failed to generate embedding for sub-query ${i + 1}:`, error);
          // Continue without this sub-query embedding
        }
      }
    }

    const response = {
      success: true,
      queryPlan: {
        ...queryPlan,
        queryEmbedding,
        subQueryEmbeddings: Object.keys(subQueryEmbeddings).length > 0 ? subQueryEmbeddings : undefined,
        timestamp: new Date().toISOString(),
        embeddingDimensions: queryEmbedding?.length || null,
        subQueryCount: queryPlan.subQueries.length
      }
    };

    console.log(`[SmartQueryPlanner] Successfully generated query plan with ${queryEmbedding ? 'vector' : 'no'} embedding and ${Object.keys(subQueryEmbeddings).length} sub-query embeddings`);
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('[SmartQueryPlanner] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
