
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Optimized API client class
class OptimizedApiClient {
  private static embeddingCache = new Map<string, number[]>();
  private static readonly CACHE_SIZE_LIMIT = 100;

  static async getEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
    const cacheKey = this.hashString(text);
    
    if (this.embeddingCache.has(cacheKey)) {
      console.log('[GPT-Master-Orchestrator] Embedding cache hit');
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000),
          encoding_format: 'float'
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const result = await response.json();
      const embedding = result.data[0].embedding;

      this.cacheEmbedding(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error('[GPT-Master-Orchestrator] Embedding generation failed:', error);
      throw error;
    }
  }

  private static cacheEmbedding(key: string, embedding: number[]): void {
    if (this.embeddingCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    this.embeddingCache.set(key, embedding);
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

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

    const requestBody = await req.json();
    const { 
      message, 
      userId, 
      threadId, 
      conversationContext = [], 
      userProfile = {},
      queryPlan = {},
      optimizedParams = {}
    } = requestBody;

    console.log(`[GPT-Master-Orchestrator] Processing query: "${message}"`);
    console.log(`[GPT-Master-Orchestrator] User ID: ${userId}`);
    console.log(`[GPT-Master-Orchestrator] Query plan strategy: ${queryPlan.strategy || 'standard'}`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Phase 1 Optimization: Intelligent search strategy with parallel execution
    let searchResults = [];
    let analysisMetadata = {
      searchMethod: 'none',
      queryComplexity: 'simple',
      resultsCount: 0,
      timestamp: new Date().toISOString(),
      processingTime: 0
    };

    const searchStartTime = Date.now();

    // Determine optimal search strategy based on query complexity
    const isComplexQuery = message.length > 100 || 
                          /\b(analyze|compare|pattern|trend|most|top|all|every)\b/i.test(message);
    
    const hasTimeContext = queryPlan.timeRange || 
                          /\b(last|this|current|recent|past|today|yesterday|week|month|year)\b/i.test(message);

    // Phase 1: Parallel search execution
    const searchPromises = [];

    // Semantic search (always run this)
    if (queryPlan.strategy === 'semantic' || queryPlan.strategy === 'hybrid' || !queryPlan.strategy) {
      console.log('[GPT-Master-Orchestrator] Starting semantic search');
      
      const semanticSearchPromise = async () => {
        try {
          const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);

          const searchParams = {
            query_embedding: queryEmbedding,
            match_threshold: isComplexQuery ? 0.2 : 0.3, // Lower threshold for complex queries
            match_count: isComplexQuery ? 15 : 8, // More results for complex queries
            start_date: queryPlan.timeRange?.startDate || null,
            end_date: queryPlan.timeRange?.endDate || null
          };

          const functionName = hasTimeContext ? 'match_journal_entries_with_date' : 'match_journal_entries_fixed';
          const { data, error } = await supabaseClient.rpc(functionName, searchParams);

          if (error) {
            console.error('Semantic search error:', error);
            return [];
          }

          console.log(`[GPT-Master-Orchestrator] Semantic search found ${data?.length || 0} results`);
          return data || [];
        } catch (error) {
          console.error('Error in semantic search:', error);
          return [];
        }
      };

      searchPromises.push({ type: 'semantic', promise: semanticSearchPromise() });
    }

    // Theme-based search (parallel execution)
    if (queryPlan.strategy === 'theme' || (queryPlan.strategy === 'hybrid' && queryPlan.extractedThemes?.length > 0)) {
      console.log('[GPT-Master-Orchestrator] Starting theme search');
      
      const themeSearchPromise = async () => {
        try {
          const { data, error } = await supabaseClient.rpc(
            'match_journal_entries_by_theme',
            {
              theme_query: queryPlan.extractedThemes?.[0] || message,
              match_threshold: 0.3,
              match_count: 5,
              start_date: queryPlan.timeRange?.startDate || null,
              end_date: queryPlan.timeRange?.endDate || null
            }
          );

          if (error) {
            console.error('Theme search error:', error);
            return [];
          }

          console.log(`[GPT-Master-Orchestrator] Theme search found ${data?.length || 0} results`);
          return data || [];
        } catch (error) {
          console.error('Error in theme search:', error);
          return [];
        }
      };

      searchPromises.push({ type: 'theme', promise: themeSearchPromise() });
    }

    // Emotion-based search (parallel execution)
    if (queryPlan.strategy === 'emotion' && queryPlan.extractedEmotions?.length > 0) {
      console.log('[GPT-Master-Orchestrator] Starting emotion search');
      
      const emotionSearchPromise = async () => {
        try {
          const { data, error } = await supabaseClient.rpc(
            'match_journal_entries_by_emotion',
            {
              emotion_name: queryPlan.extractedEmotions[0],
              min_score: 0.3,
              start_date: queryPlan.timeRange?.startDate || null,
              end_date: queryPlan.timeRange?.endDate || null,
              limit_count: 5
            }
          );

          if (error) {
            console.error('Emotion search error:', error);
            return [];
          }

          console.log(`[GPT-Master-Orchestrator] Emotion search found ${data?.length || 0} results`);
          return data || [];
        } catch (error) {
          console.error('Error in emotion search:', error);
          return [];
        }
      };

      searchPromises.push({ type: 'emotion', promise: emotionSearchPromise() });
    }

    // Execute all searches in parallel
    const searchResults_parallel = await Promise.all(searchPromises.map(s => s.promise));
    
    // Merge and deduplicate results
    const allResults = new Map();
    searchResults_parallel.forEach((results, index) => {
      const searchType = searchPromises[index].type;
      results.forEach((result: any) => {
        if (!allResults.has(result.id)) {
          allResults.set(result.id, { ...result, searchType });
        }
      });
    });

    searchResults = Array.from(allResults.values());
    
    // Update metadata
    analysisMetadata.searchMethod = searchPromises.map(s => s.type).join('+');
    analysisMetadata.resultsCount = searchResults.length;
    analysisMetadata.queryComplexity = isComplexQuery ? 'complex' : 'simple';

    const searchTime = Date.now() - searchStartTime;
    console.log(`[GPT-Master-Orchestrator] Parallel search completed in ${searchTime}ms`);

    // Phase 1: Statistical analysis (only for complex queries to save time)
    let statisticalAnalysis = null;
    if (queryPlan.requiresStatistics && isComplexQuery && searchResults.length > 0) {
      console.log('[GPT-Master-Orchestrator] Performing statistical analysis');
      
      try {
        const { data: topEmotions, error: emotionsError } = await supabaseClient.rpc(
          'get_top_emotions_with_entries',
          {
            start_date: queryPlan.timeRange?.startDate || null,
            end_date: queryPlan.timeRange?.endDate || null,
            limit_count: 5
          }
        );

        if (!emotionsError && topEmotions) {
          statisticalAnalysis = {
            topEmotions: topEmotions,
            entryCount: searchResults.length,
            timeRange: queryPlan.timeRange
          };
          console.log(`[GPT-Master-Orchestrator] Statistical analysis completed`);
        }
      } catch (error) {
        console.error('Error in statistical analysis:', error);
      }
    }

    // Phase 1: Optimized AI response generation
    console.log('[GPT-Master-Orchestrator] Generating AI response');
    
    // Optimize context building for better performance
    const maxContextEntries = isComplexQuery ? 10 : 6;
    const contextText = searchResults
      .slice(0, maxContextEntries)
      .map(entry => {
        const content = entry.content?.slice(0, 250) || 'No content';
        const date = new Date(entry.created_at).toLocaleDateString();
        return `Entry ${entry.id} (${date}): ${content}`;
      })
      .join('\n\n');

    // Intelligent model selection based on query complexity
    const useGPT4 = isComplexQuery && (searchResults.length > 5 || statisticalAnalysis);
    const model = useGPT4 ? 'gpt-4o' : 'gpt-4o-mini';
    const maxTokens = isComplexQuery ? 1200 : 800;

    // Optimized system prompt for better performance
    const systemPrompt = `You are an empathetic AI journal analyst. Analyze the user's question based on their journal entries and provide helpful insights.

User Profile: ${JSON.stringify(userProfile)}
Query Context: ${JSON.stringify(queryPlan)}

Journal Entries Context:
${contextText}

${statisticalAnalysis ? `Statistical Analysis: ${JSON.stringify(statisticalAnalysis)}` : ''}

Guidelines:
- Be empathetic and supportive
- Provide specific insights based on the journal entries
- Reference specific entries when relevant
- If no relevant entries are found, acknowledge this and offer general guidance
- Keep responses conversational and helpful
- Focus on patterns, growth, and positive insights`;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationContext.slice(-4), // Reduced context for performance
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: maxTokens
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`OpenAI API error: ${chatResponse.status} - ${await chatResponse.text()}`);
    }

    const chatResult = await chatResponse.json();
    const aiResponse = chatResult.choices[0].message.content;

    const totalTime = Date.now() - startTime;
    analysisMetadata.processingTime = totalTime;

    console.log(`[GPT-Master-Orchestrator] Response generated successfully in ${totalTime}ms using ${model}`);

    return new Response(JSON.stringify({
      response: aiResponse,
      analysis: {
        ...analysisMetadata,
        hasStatistics: !!statisticalAnalysis,
        queryPlan: queryPlan,
        modelUsed: model,
        optimizationsApplied: ['parallel_search', 'intelligent_model_selection', 'optimized_context']
      },
      referenceEntries: searchResults.slice(0, 5).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.themes || [],
        emotions: entry.emotions || {},
        searchType: entry.searchType
      })),
      statisticalData: statisticalAnalysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Master Orchestrator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'processing_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
