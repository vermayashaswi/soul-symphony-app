
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

// Fallback search strategies
async function fallbackTextSearch(supabase: any, userId: string, message: string, queryPlan: any) {
  console.log('[GPT-Master-Orchestrator] Using fallback text search');
  
  const searchTerms = message.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  
  if (searchTerms.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('Journal Entries')
    .select('id, "refined text", "transcription text", created_at, master_themes, emotions')
    .eq('user_id', userId)
    .or(searchTerms.map(term => 
      `"refined text".ilike.%${term}%,"transcription text".ilike.%${term}%`
    ).join(','))
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('[GPT-Master-Orchestrator] Fallback text search error:', error);
    return [];
  }

  return (data || []).map(entry => ({
    id: entry.id,
    content: entry['refined text'] || entry['transcription text'] || '',
    created_at: entry.created_at,
    themes: entry.master_themes || [],
    emotions: entry.emotions || {},
    searchType: 'text_fallback',
    similarity: 0.5 // Default similarity for text matches
  }));
}

async function fallbackRecentEntries(supabase: any, userId: string) {
  console.log('[GPT-Master-Orchestrator] Using fallback recent entries');
  
  const { data, error } = await supabase
    .from('Journal Entries')
    .select('id, "refined text", "transcription text", created_at, master_themes, emotions')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[GPT-Master-Orchestrator] Fallback recent entries error:', error);
    return [];
  }

  return (data || []).map(entry => ({
    id: entry.id,
    content: entry['refined text'] || entry['transcription text'] || '',
    created_at: entry.created_at,
    themes: entry.master_themes || [],
    emotions: entry.emotions || {},
    searchType: 'recent_fallback',
    similarity: 0.4 // Default similarity for recent matches
  }));
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

    // Enhanced search strategy with fallbacks
    let searchResults = [];
    let analysisMetadata = {
      searchMethod: 'none',
      queryComplexity: 'simple',
      resultsCount: 0,
      timestamp: new Date().toISOString(),
      processingTime: 0,
      fallbackUsed: false
    };

    const searchStartTime = Date.now();

    // Determine optimal search strategy based on query complexity
    const isComplexQuery = message.length > 100 || 
                          /\b(analyze|compare|pattern|trend|most|top|all|every)\b/i.test(message);
    
    const hasTimeContext = queryPlan.timeRange || 
                          /\b(last|this|current|recent|past|today|yesterday|week|month|year)\b/i.test(message);

    // Primary semantic search attempt
    try {
      console.log('[GPT-Master-Orchestrator] Starting semantic search');
      
      const queryEmbedding = await OptimizedApiClient.getEmbedding(message, openaiApiKey);

      // Fix: Use the correct function signature for match_journal_entries_fixed
      const searchParams = {
        query_embedding: queryEmbedding,
        match_threshold: isComplexQuery ? 0.2 : 0.3,
        match_count: isComplexQuery ? 15 : 8,
        user_id_filter: userId
      };

      let semanticData, semanticError;

      if (hasTimeContext && queryPlan.timeRange) {
        // Use time-filtered search
        const timeParams = {
          ...searchParams,
          start_date: queryPlan.timeRange.startDate || null,
          end_date: queryPlan.timeRange.endDate || null
        };
        
        const result = await supabaseClient.rpc('match_journal_entries_with_date', timeParams);
        semanticData = result.data;
        semanticError = result.error;
      } else {
        // Use standard semantic search with correct parameters
        const result = await supabaseClient.rpc('match_journal_entries_fixed', searchParams);
        semanticData = result.data;
        semanticError = result.error;
      }

      if (semanticError) {
        console.error('[GPT-Master-Orchestrator] Semantic search error:', semanticError);
        throw semanticError;
      }

      if (semanticData && semanticData.length > 0) {
        searchResults = semanticData.map((entry: any) => ({
          ...entry,
          content: entry.content || '',
          searchType: 'semantic'
        }));
        
        analysisMetadata.searchMethod = 'semantic';
        console.log(`[GPT-Master-Orchestrator] Semantic search found ${searchResults.length} results`);
      } else {
        throw new Error('No semantic results found');
      }

    } catch (semanticError) {
      console.log(`[GPT-Master-Orchestrator] Semantic search failed: ${semanticError.message}, trying fallbacks`);
      analysisMetadata.fallbackUsed = true;

      // Fallback 1: Text-based search
      try {
        searchResults = await fallbackTextSearch(supabaseClient, userId, message, queryPlan);
        
        if (searchResults.length > 0) {
          analysisMetadata.searchMethod = 'text_fallback';
          console.log(`[GPT-Master-Orchestrator] Text fallback found ${searchResults.length} results`);
        } else {
          throw new Error('No text fallback results');
        }
      } catch (textError) {
        console.log(`[GPT-Master-Orchestrator] Text fallback failed, using recent entries`);
        
        // Fallback 2: Recent entries
        searchResults = await fallbackRecentEntries(supabaseClient, userId);
        analysisMetadata.searchMethod = 'recent_fallback';
        console.log(`[GPT-Master-Orchestrator] Recent entries fallback found ${searchResults.length} results`);
      }
    }

    // Update metadata
    analysisMetadata.resultsCount = searchResults.length;
    analysisMetadata.queryComplexity = isComplexQuery ? 'complex' : 'simple';

    const searchTime = Date.now() - searchStartTime;
    console.log(`[GPT-Master-Orchestrator] Search completed in ${searchTime}ms using ${analysisMetadata.searchMethod}`);

    // Statistical analysis (only for complex queries with results)
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

    // AI response generation with enhanced context
    console.log('[GPT-Master-Orchestrator] Generating AI response');
    
    const maxContextEntries = isComplexQuery ? 10 : 6;
    const contextText = searchResults
      .slice(0, maxContextEntries)
      .map(entry => {
        const content = entry.content?.slice(0, 250) || 'No content';
        const date = new Date(entry.created_at).toLocaleDateString();
        const searchMethod = entry.searchType || 'unknown';
        return `Entry ${entry.id} (${date}, found via ${searchMethod}): ${content}`;
      })
      .join('\n\n');

    // Intelligent model selection
    const useGPT4 = isComplexQuery && (searchResults.length > 5 || statisticalAnalysis);
    const model = useGPT4 ? 'gpt-4o' : 'gpt-4o-mini';
    const maxTokens = isComplexQuery ? 1200 : 800;

    // Enhanced system prompt with fallback information
    const systemPrompt = `You are an empathetic AI journal analyst. Analyze the user's question based on their journal entries and provide helpful insights.

User Profile: ${JSON.stringify(userProfile)}
Query Context: ${JSON.stringify(queryPlan)}
Search Method Used: ${analysisMetadata.searchMethod}
${analysisMetadata.fallbackUsed ? 'Note: Primary search failed, using fallback method.' : ''}

Journal Entries Context:
${contextText}

${statisticalAnalysis ? `Statistical Analysis: ${JSON.stringify(statisticalAnalysis)}` : ''}

Guidelines:
- Be empathetic and supportive
- Provide specific insights based on the journal entries found
- Reference specific entries when relevant
- If using fallback search results, acknowledge that the analysis might be limited
- If no highly relevant entries were found, offer general guidance while acknowledging the limitation
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
          ...conversationContext.slice(-4),
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
        optimizationsApplied: ['enhanced_fallback', 'intelligent_model_selection', 'optimized_context']
      },
      referenceEntries: searchResults.slice(0, 5).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.themes || [],
        emotions: entry.emotions || {},
        searchType: entry.searchType || 'unknown'
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
