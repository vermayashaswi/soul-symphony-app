

// Optimized API client with enhanced response generation
export class OptimizedApiClient {
  private static responseCache = new Map<string, string>();
  private static readonly CACHE_SIZE_LIMIT = 50;

  static async generateResponseOptimized(
    systemPrompt: string,
    userPrompt: string,
    conversationContext: any[] = [],
    openAiApiKey: string,
    isAnalyticalQuery: boolean = false,
    performanceMode: 'fast' | 'balanced' | 'quality' = 'balanced'
  ): Promise<string> {
    try {
      console.log('[OptimizedApiClient] Generating response with performance optimization');
      
      // Import PerformanceOptimizer
      const { PerformanceOptimizer } = await import('./performanceOptimizer.ts');
      
      // Detect if this is an analytical query that needs structured formatting
      const analyticalKeywords = [
        'pattern', 'trend', 'analysis', 'when do i', 'what time', 'how often',
        'frequency', 'usually', 'typically', 'most', 'least', 'statistics',
        'insights', 'breakdown', 'summary', 'overview', 'comparison'
      ];
      
      const isAnalytical = isAnalyticalQuery || 
        analyticalKeywords.some(keyword => 
          userPrompt.toLowerCase().includes(keyword) ||
          systemPrompt.toLowerCase().includes(keyword)
        );

      // Optimize prompts based on performance mode
      let optimizedSystemPrompt = systemPrompt;
      let optimizedUserPrompt = userPrompt;
      
      if (performanceMode === 'fast') {
        optimizedSystemPrompt = PerformanceOptimizer.compressPrompt(systemPrompt, 0.7);
        optimizedUserPrompt = PerformanceOptimizer.compressPrompt(userPrompt, 0.8);
      }

      // Enhanced system prompt for analytical queries
      if (isAnalytical) {
        optimizedSystemPrompt += `

CRITICAL FORMATTING REQUIREMENTS FOR ANALYTICAL RESPONSES:
- Use clear headers with ## markdown formatting
- Structure information with bullet points using -
- Use **bold text** for key insights and important data points
- Create logical sections: Overview, Key Findings, Patterns, Recommendations
- Include specific data points and statistics when available
- Make responses scannable and well-organized
- Use numbered lists for step-by-step insights or rankings

RESPONSE STRUCTURE TEMPLATE:
## Key Insights
- **Primary finding**: [main insight]
- **Supporting data**: [specific evidence]

## Patterns Identified
- [Pattern 1 with evidence]
- [Pattern 2 with evidence]

## Recommendations
- [Actionable suggestion based on analysis]`;
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(optimizedSystemPrompt, optimizedUserPrompt);
      
      // Check cache first
      if (this.responseCache.has(cacheKey)) {
        console.log('[OptimizedApiClient] Cache hit for response');
        return this.responseCache.get(cacheKey)!;
      }

      // Prepare messages with enhanced context
      const messages = [
        { role: 'system', content: optimizedSystemPrompt }
      ];

      // Add conversation context with smart truncation
      if (conversationContext.length > 0) {
        const contextLimit = performanceMode === 'fast' ? 4 : 6;
        messages.push(...conversationContext.slice(-contextLimit));
      }

      messages.push({ role: 'user', content: optimizedUserPrompt });

      // Intelligent model selection based on performance mode and query complexity
      let model = 'gpt-4.1-2025-04-14';
      let maxTokens = 600;
      
      if (performanceMode === 'quality' && isAnalytical) {
        model = 'gpt-4.1-2025-04-14';
        maxTokens = 1200;
      } else if (isAnalytical) {
        model = 'gpt-4.1-2025-04-14';
        maxTokens = 800;
      } else if (performanceMode === 'fast') {
        maxTokens = 400;
      }

      // Use optimized request parameters
      const requestParams = PerformanceOptimizer.optimizeOpenAIRequest(
        JSON.stringify(messages), 
        maxTokens, 
        isAnalytical
      );

      // Helper to make a timed OpenAI call
      const makeCall = async (mdl: string, tokens: number) => {
        const start = Date.now();
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: mdl,
            messages,
            max_tokens: tokens,
            temperature: 0.7
          }),
        });
        const duration = Date.now() - start;
        console.log(`[OptimizedApiClient] OpenAI call (Chat Completions) model=${mdl} status=${resp.status} duration=${duration}ms`);
        return resp;
      };

      // Primary attempt
      let response = await makeCall(model, maxTokens);

      // Fallback to smaller model if needed
      if (!response.ok) {
        console.warn(`[OptimizedApiClient] Primary model failed (status ${response.status}). Trying fallback model...`);
        const errText = await response.text().catch(() => '');
        console.warn('[OptimizedApiClient] Primary error text:', errText?.slice(0, 250));
        const fallbackModel = 'gpt-4.1-2025-04-14';
        const fallbackTokens = Math.min(400, Math.floor(maxTokens * 0.7));
        response = await makeCall(fallbackModel, fallbackTokens);
        if (!response.ok) {
          const fallbackErr = await response.text().catch(() => '');
          throw new Error(`OpenAI API error after fallback: ${response.status} - ${fallbackErr}`);
        }
        model = fallbackModel;
      }

      const data = await response.json();
      let result = data?.choices?.[0]?.message?.content ?? '';
      if (!result || !result.trim()) {
        throw new Error('Empty completion content from OpenAI Chat Completions');
      }

      // Cache the response
      this.setCachedResponse(cacheKey, result);
      
      console.log(`[OptimizedApiClient] Generated ${isAnalytical ? 'analytical' : 'standard'} response using ${model}`);
      return result;
    } catch (error) {
      console.error('[OptimizedApiClient] Error generating response:', error);
      throw error;
    }
  }

  static async getEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
    try {
      console.log(`[OptimizedApiClient] Generating embedding for text: "${text.substring(0, 100)}..."`);
      
      // Enhanced text preprocessing for better embeddings
      const cleanedText = text
        .trim()
        .replace(/\s+/g, ' ') // normalize whitespace
        .substring(0, 8000); // OpenAI limit
      
      if (!cleanedText) {
        console.error('[OptimizedApiClient] Empty text provided for embedding');
        throw new Error('Cannot generate embedding for empty text');
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: cleanedText,
          encoding_format: 'float'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OptimizedApiClient] Embedding API error: ${response.status} - ${errorText}`);
        throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.data || !result.data[0] || !result.data[0].embedding) {
        console.error('[OptimizedApiClient] Invalid embedding response structure:', result);
        throw new Error('Invalid embedding response structure');
      }

      const embedding = result.data[0].embedding;
      console.log(`[OptimizedApiClient] Successfully generated embedding of length: ${embedding.length}`);
      
      return embedding;
    } catch (error) {
      console.error('[OptimizedApiClient] Embedding generation failed:', error);
      throw error;
    }
  }

  private static generateCacheKey(systemPrompt: string, userPrompt: string): string {
    const combined = systemPrompt + userPrompt;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private static setCachedResponse(key: string, response: string): void {
    if (this.responseCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    this.responseCache.set(key, response);
  }
}

