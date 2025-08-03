
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSE Stream Manager for real-time updates
class SSEStreamManager {
  private encoder = new TextEncoder();

  constructor(private response: ReadableStreamDefaultController) {}

  sendProgress(message: string, data?: any) {
    const progressData = JSON.stringify({
      type: 'progress',
      message,
      data,
      timestamp: new Date().toISOString()
    });
    this.response.enqueue(this.encoder.encode(`data: ${progressData}\n\n`));
  }

  sendResult(result: any) {
    const resultData = JSON.stringify({
      type: 'result',
      data: result,
      timestamp: new Date().toISOString()
    });
    this.response.enqueue(this.encoder.encode(`data: ${resultData}\n\n`));
    this.response.close();
  }

  sendError(error: string) {
    const errorData = JSON.stringify({
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
    this.response.enqueue(this.encoder.encode(`data: ${errorData}\n\n`));
    this.response.close();
  }
}

// Enhanced cache for query results
class EnhancedCache {
  private static cache = new Map();
  private static TTL = 5 * 60 * 1000; // 5 minutes

  static get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  static set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

// Optimized API Client for embeddings and responses
class OptimizedApiClient {
  static async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  static async generateResponse(messages: any[], options: any = {}): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }
}

// Dual Search Orchestrator
class DualSearchOrchestrator {
  static async executeParallelSearch(
    supabase: any, 
    userId: string, 
    queryEmbedding: number[], 
    queryPlan: any, 
    message: string
  ): Promise<{ vectorResults: any[], sqlResults: any[], combinedResults: any[] }> {
    const [vectorResults, sqlResults] = await Promise.all([
      this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan),
      this.executeSQLBasedSearch(supabase, userId, queryPlan, message)
    ]);

    const combinedResults = this.combineAndDeduplicateResults(vectorResults, sqlResults);
    
    return { vectorResults, sqlResults, combinedResults };
  }

  private static async executeVectorSearch(supabase: any, userId: string, queryEmbedding: number[], queryPlan: any): Promise<any[]> {
    const { data, error } = await supabase.rpc('match_journal_entries', {
      query_embedding: queryEmbedding,
      match_threshold: queryPlan.vectorThreshold || 0.3,
      match_count: queryPlan.maxEntries || 10,
      user_id_filter: userId
    });

    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    return (data || []).map((entry: any) => ({
      ...entry,
      searchMethod: 'vector'
    }));
  }

  private static async executeSQLBasedSearch(supabase: any, userId: string, queryPlan: any, message: string): Promise<any[]> {
    if (!queryPlan.subQuestions || queryPlan.subQuestions.length === 0) {
      return [];
    }

    const sqlResults: any[] = [];
    
    for (const subQuery of queryPlan.subQuestions) {
      if (!subQuery.searchPlan?.sqlQueries) continue;
      
      for (const sqlQuery of subQuery.searchPlan.sqlQueries) {
        try {
          const parameters = { ...sqlQuery.parameters };
          // Replace user_id placeholder
          if (parameters.user_id === 'user_id_placeholder') {
            parameters.user_id = userId;
          }

          const { data, error } = await supabase.rpc(sqlQuery.function, parameters);
          
          if (error) {
            console.error(`SQL function ${sqlQuery.function} error:`, error);
            continue;
          }

          if (data && Array.isArray(data)) {
            sqlResults.push(...data.map((item: any) => ({
              ...item,
              searchMethod: 'sql',
              subQuery: subQuery.question,
              purpose: sqlQuery.purpose
            })));
          }
        } catch (error) {
          console.error(`Error executing SQL function ${sqlQuery.function}:`, error);
        }
      }
    }

    return sqlResults;
  }

  private static combineAndDeduplicateResults(vectorResults: any[], sqlResults: any[]): any[] {
    const combined = [...vectorResults, ...sqlResults];
    const seen = new Set();
    
    return combined.filter(result => {
      const key = result.id || result.emotion || result.entity_name || JSON.stringify(result);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).sort((a, b) => {
      // Prioritize by relevance and search method
      const aScore = (a.similarity || a.score || a.avg_sentiment_score || 0);
      const bScore = (b.similarity || b.score || b.avg_sentiment_score || 0);
      return bScore - aScore;
    });
  }
}

// Optimized RAG Pipeline
class OptimizedRagPipeline {
  constructor(
    private streamManager: SSEStreamManager,
    private supabaseClient: any,
    private openaiApiKey: string
  ) {}

  async processQuery(requestData: any): Promise<void> {
    const { message, userId, threadId, conversationContext = [] } = requestData;

    try {
      this.streamManager.sendProgress('Initializing advanced RAG pipeline...');

      // Step 1: Enhanced message classification
      this.streamManager.sendProgress('Classifying query intent...');
      const classification = await this.classifyMessage(message, conversationContext);
      
      // Step 2: Intelligent query planning
      this.streamManager.sendProgress('Planning optimal search strategy...');
      const queryPlan = await this.planQuery(message, userId, classification);
      
      // Step 3: Check cache
      const cacheKey = `${userId}-${message}-${JSON.stringify(queryPlan)}`;
      let cachedResult = EnhancedCache.get(cacheKey);
      
      if (cachedResult) {
        this.streamManager.sendProgress('Using cached results...');
        await this.saveConversation(threadId, message, cachedResult.response, cachedResult.references);
        this.streamManager.sendResult(cachedResult);
        return;
      }

      // Step 4: Generate embedding
      this.streamManager.sendProgress('Generating semantic embeddings...');
      const queryEmbedding = await OptimizedApiClient.getEmbedding(message);

      // Step 5: Execute parallel search
      this.streamManager.sendProgress('Executing intelligent search...');
      const searchResults = await DualSearchOrchestrator.executeParallelSearch(
        this.supabaseClient,
        userId,
        queryEmbedding,
        queryPlan,
        message
      );

      // Step 6: Generate contextual response
      this.streamManager.sendProgress('Generating intelligent response...');
      const response = await this.generateContextualResponse(
        message,
        searchResults,
        classification,
        queryPlan
      );

      // Step 7: Save conversation
      await this.saveConversation(threadId, message, response, searchResults.combinedResults);

      // Step 8: Cache result
      const result = {
        response,
        references: searchResults.combinedResults,
        analysis: {
          classification,
          queryPlan,
          searchResults: {
            vectorCount: searchResults.vectorResults.length,
            sqlCount: searchResults.sqlResults.length,
            totalCount: searchResults.combinedResults.length
          }
        }
      };

      EnhancedCache.set(cacheKey, result);
      this.streamManager.sendResult(result);

    } catch (error) {
      console.error('Error in OptimizedRagPipeline:', error);
      this.streamManager.sendError(error.message);
    }
  }

  private async classifyMessage(message: string, conversationContext: any[]): Promise<any> {
    try {
      const { data, error } = await this.supabaseClient.functions.invoke('chat-query-classifier', {
        body: { message, conversationContext }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Classification error:', error);
      // Fallback classification
      return {
        category: 'JOURNAL_SPECIFIC',
        confidence: 0.7,
        shouldUseJournal: true,
        useAllEntries: true,
        reasoning: 'Fallback classification'
      };
    }
  }

  private async planQuery(message: string, userId: string, classification: any): Promise<any> {
    try {
      const { data, error } = await this.supabaseClient.functions.invoke('smart-query-planner', {
        body: { 
          message, 
          userId,
          classification,
          conversationContext: []
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Query planning error:', error);
      // Fallback plan
      return {
        strategy: 'comprehensive',
        maxEntries: 10,
        vectorThreshold: 0.3,
        subQuestions: []
      };
    }
  }

  private async generateContextualResponse(
    message: string,
    searchResults: any,
    classification: any,
    queryPlan: any
  ): Promise<string> {
    const context = this.buildContext(searchResults);
    
    const systemPrompt = `You are an advanced AI assistant specializing in journal analysis and personal insights.

Classification: ${classification.category} (confidence: ${classification.confidence})
Strategy: ${queryPlan.strategy}

Context from journal entries and analysis:
${context}

Instructions:
- Provide personalized, empathetic responses based on the user's journaling history
- Use insights from both semantic search and structured data analysis
- Reference specific patterns, themes, and emotions when relevant
- Be conversational but insightful
- Focus on the user's personal growth and self-understanding`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    return await OptimizedApiClient.generateResponse(messages, {
      temperature: 0.7,
      max_tokens: 1000
    });
  }

  private buildContext(searchResults: any): string {
    let context = '';
    
    // Add vector search results
    if (searchResults.vectorResults.length > 0) {
      context += 'Relevant journal entries:\n';
      searchResults.vectorResults.slice(0, 5).forEach((entry: any, index: number) => {
        context += `${index + 1}. ${entry.content || entry.text} (${entry.created_at})\n`;
      });
      context += '\n';
    }

    // Add SQL analysis results
    if (searchResults.sqlResults.length > 0) {
      context += 'Data insights:\n';
      searchResults.sqlResults.forEach((result: any, index: number) => {
        if (result.emotion) {
          context += `- Emotion "${result.emotion}": score ${result.score}, ${result.sample_entries?.length || 0} entries\n`;
        } else if (result.entity_name) {
          context += `- Entity "${result.entity_name}" (${result.entity_type}): ${result.entry_count} mentions\n`;
        } else if (result.theme) {
          context += `- Theme "${result.theme}": ${result.entry_count} entries\n`;
        }
      });
      context += '\n';
    }

    return context || 'No relevant context found.';
  }

  private async saveConversation(threadId: string, message: string, response: string, references: any[]): Promise<void> {
    try {
      await this.supabaseClient
        .from('chat_messages')
        .insert([
          {
            thread_id: threadId,
            sender: 'user',
            content: message
          },
          {
            thread_id: threadId,
            sender: 'assistant',
            content: response,
            reference_entries: references || []
          }
        ]);

      await this.supabaseClient
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const requestData = await req.json();
    console.log('[Advanced RAG] Processing request:', requestData);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create streaming response
    const stream = new ReadableStream({
      start(controller) {
        const streamManager = new SSEStreamManager(controller);
        const pipeline = new OptimizedRagPipeline(
          streamManager,
          supabaseClient,
          Deno.env.get('OPENAI_API_KEY') ?? ''
        );
        
        pipeline.processQuery(requestData);
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in advanced RAG function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
