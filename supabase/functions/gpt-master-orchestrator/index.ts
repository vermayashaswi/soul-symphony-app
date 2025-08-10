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

// Enhanced fallback search strategies
class FallbackSearchStrategy {
  static async executeSemanticSearch(
    supabaseClient: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any
  ): Promise<any[]> {
    console.log('[GPT-Master-Orchestrator] Executing semantic search');
    
    try {
      const { data, error } = await supabaseClient.rpc(
        'match_journal_entries_fixed',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 10,
          user_id_filter: userId
        }
      );

      if (error) {
        console.error('[GPT-Master-Orchestrator] Semantic search error:', error);
        throw error;
      }

      console.log(`[GPT-Master-Orchestrator] Semantic search found ${data?.length || 0} results`);
      return data || [];
    } catch (error) {
      console.error('[GPT-Master-Orchestrator] Semantic search failed:', error);
      throw error;
    }
  }

  static async executeKeywordSearch(
    supabaseClient: any,
    userId: string,
    message: string,
    queryPlan: any
  ): Promise<any[]> {
    console.log('[GPT-Master-Orchestrator] Executing keyword search fallback');
    
    try {
      // Extract key terms from the message
      const keywords = message.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);

      if (keywords.length === 0) {
        return [];
      }

      const keywordQuery = keywords.join(' | ');
      
      const { data, error } = await supabaseClient
        .from('Journal Entries')
        .select(`
          id,
          created_at,
          "refined text",
          "transcription text",
          master_themes,
          emotions
        `)
        .eq('user_id', userId)
        .or(`"refined text".ilike.%${keywords[0]}%,"transcription text".ilike.%${keywords[0]}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[GPT-Master-Orchestrator] Keyword search error:', error);
        throw error;
      }

      const results = (data || []).map(entry => ({
        id: entry.id,
        content: entry["refined text"] || entry["transcription text"] || '',
        created_at: entry.created_at,
        themes: entry.master_themes || [],
        emotions: entry.emotions || {},
        similarity: 0.5, // Default similarity for keyword matches
        searchType: 'keyword'
      }));

      console.log(`[GPT-Master-Orchestrator] Keyword search found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('[GPT-Master-Orchestrator] Keyword search failed:', error);
      throw error;
    }
  }

  static async executeRecentEntriesSearch(
    supabaseClient: any,
    userId: string,
    queryPlan: any
  ): Promise<any[]> {
    console.log('[GPT-Master-Orchestrator] Executing recent entries fallback');
    
    try {
      const { data, error } = await supabaseClient
        .from('Journal Entries')
        .select(`
          id,
          created_at,
          "refined text",
          "transcription text",
          master_themes,
          emotions
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('[GPT-Master-Orchestrator] Recent entries search error:', error);
        throw error;
      }

      const results = (data || []).map(entry => ({
        id: entry.id,
        content: entry["refined text"] || entry["transcription text"] || '',
        created_at: entry.created_at,
        themes: entry.master_themes || [],
        emotions: entry.emotions || {},
        similarity: 0.3, // Default similarity for recent entries
        searchType: 'recent'
      }));

      console.log(`[GPT-Master-Orchestrator] Recent entries search found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('[GPT-Master-Orchestrator] Recent entries search failed:', error);
      throw error;
    }
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

    // Phase 1: Enhanced search with comprehensive fallback strategy
    let searchResults = [];
    let analysisMetadata = {
      searchMethod: 'none',
      queryComplexity: 'simple',
      resultsCount: 0,
      timestamp: new Date().toISOString(),
      processingTime: 0,
      fallbacksUsed: []
    };

    const searchStartTime = Date.now();

    // Determine optimal search strategy based on query complexity
    const isComplexQuery = message.length > 100 || 
                          /\b(analyze|compare|pattern|trend|most|top|all|every)\b/i.test(message);
    
    const hasTimeContext = queryPlan.timeRange || 
                          /\b(last|this|current|recent|past|today|yesterday|week|month|year)\b/i.test(message);

    // Phase 1: Primary semantic search with comprehensive fallback
    try {
      console.log('[GPT-Master-Orchestrator] Starting primary semantic search');
      const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);
      
      searchResults = await FallbackSearchStrategy.executeSemanticSearch(
        supabaseClient,
        userId,
        queryEmbedding,
        queryPlan
      );

      analysisMetadata.searchMethod = 'semantic';
      
      // If semantic search returns no results, execute fallback strategies
      if (searchResults.length === 0) {
        console.log('[GPT-Master-Orchestrator] Semantic search returned no results, trying fallback strategies');
        
        // Fallback 1: Keyword search
        try {
          const keywordResults = await FallbackSearchStrategy.executeKeywordSearch(
            supabaseClient,
            userId,
            message,
            queryPlan
          );
          
          if (keywordResults.length > 0) {
            searchResults = keywordResults;
            analysisMetadata.searchMethod = 'keyword_fallback';
            analysisMetadata.fallbacksUsed.push('keyword');
            console.log('[GPT-Master-Orchestrator] Keyword fallback successful');
          }
        } catch (keywordError) {
          console.error('[GPT-Master-Orchestrator] Keyword fallback failed:', keywordError);
          analysisMetadata.fallbacksUsed.push('keyword_failed');
        }

        // Fallback 2: Recent entries search (if keyword search also failed)
        if (searchResults.length === 0) {
          try {
            const recentResults = await FallbackSearchStrategy.executeRecentEntriesSearch(
              supabaseClient,
              userId,
              queryPlan
            );
            
            if (recentResults.length > 0) {
              searchResults = recentResults;
              analysisMetadata.searchMethod = 'recent_fallback';
              analysisMetadata.fallbacksUsed.push('recent_entries');
              console.log('[GPT-Master-Orchestrator] Recent entries fallback successful');
            }
          } catch (recentError) {
            console.error('[GPT-Master-Orchestrator] Recent entries fallback failed:', recentError);
            analysisMetadata.fallbacksUsed.push('recent_failed');
          }
        }
      }

    } catch (semanticError) {
      console.error('[GPT-Master-Orchestrator] Primary semantic search failed:', semanticError);
      analysisMetadata.fallbacksUsed.push('semantic_failed');
      
      // If semantic search completely fails, try fallback strategies
      try {
        const keywordResults = await FallbackSearchStrategy.executeKeywordSearch(
          supabaseClient,
          userId,
          message,
          queryPlan
        );
        
        if (keywordResults.length > 0) {
          searchResults = keywordResults;
          analysisMetadata.searchMethod = 'keyword_emergency_fallback';
          analysisMetadata.fallbacksUsed.push('keyword_emergency');
        } else {
          // Final fallback to recent entries
          const recentResults = await FallbackSearchStrategy.executeRecentEntriesSearch(
            supabaseClient,
            userId,
            queryPlan
          );
          searchResults = recentResults;
          analysisMetadata.searchMethod = 'recent_emergency_fallback';
          analysisMetadata.fallbacksUsed.push('recent_emergency');
        }
      } catch (fallbackError) {
        console.error('[GPT-Master-Orchestrator] All fallback strategies failed:', fallbackError);
        analysisMetadata.searchMethod = 'all_failed';
        analysisMetadata.fallbacksUsed.push('all_failed');
      }
    }

    // Update metadata
    analysisMetadata.resultsCount = searchResults.length;
    analysisMetadata.queryComplexity = isComplexQuery ? 'complex' : 'simple';

    const searchTime = Date.now() - searchStartTime;
    console.log(`[GPT-Master-Orchestrator] Search completed in ${searchTime}ms using method: ${analysisMetadata.searchMethod}`);

    // Phase 2: Statistical analysis (only for complex queries to save time)
    let statisticalAnalysis = null;
    if (queryPlan.requiresStatistics && isComplexQuery && searchResults.length > 0) {
      console.log('[GPT-Master-Orchestrator] Performing statistical analysis');
      
      try {
        const { data: topEmotions, error: emotionsError } = await supabaseClient.rpc(
          'get_top_emotions_with_entries',
          {
            user_id_param: userId,
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

    // Phase 3: Optimized AI response generation
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

    const model = 'gpt-5-mini';
    const maxTokens = isComplexQuery ? 1200 : 800;

    // Optimized system prompt for better performance
    let systemPrompt = `You are an empathetic AI journal analyst. Analyze the user's question based on their journal entries and provide helpful insights.

User Profile: ${JSON.stringify(userProfile)}
Query Context: ${JSON.stringify(queryPlan)}

Journal Entries Context:
${contextText}

${statisticalAnalysis ? `Statistical Analysis: ${JSON.stringify(statisticalAnalysis)}` : ''}

Guidelines:
- Be empathetic and supportive
- Provide specific insights based on the journal entries
- Reference specific entries when relevant`;

    // Add context about search method if fallbacks were used
    if (analysisMetadata.fallbacksUsed.length > 0) {
      systemPrompt += `
- Note: I used ${analysisMetadata.searchMethod} to find relevant entries`;
    }

    if (searchResults.length === 0) {
      systemPrompt += `
- No specific journal entries were found for this query, so provide general guidance and encourage the user to write more entries`;
    }

    systemPrompt += `
- Keep responses conversational and helpful
- Focus on patterns, growth, and positive insights`;

    const tokensKey = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
    const payload: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationContext.slice(-4), // Reduced context for performance
        { role: 'user', content: message }
      ],
      temperature: 0.7
    };
    (payload as any)[tokensKey] = maxTokens;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
        optimizationsApplied: ['parallel_search', 'intelligent_model_selection', 'optimized_context', 'comprehensive_fallback']
      },
      referenceEntries: searchResults.slice(0, 5).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.themes || [],
        emotions: entry.emotions || {},
        searchType: entry.searchType || 'semantic'
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
