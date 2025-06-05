
// Optimized API client with enhanced response generation
export class OptimizedApiClient {
  private static responseCache = new Map<string, string>();
  private static readonly CACHE_SIZE_LIMIT = 50;

  static async generateResponseOptimized(
    systemPrompt: string,
    userPrompt: string,
    conversationContext: any[] = [],
    openAiApiKey: string,
    isAnalyticalQuery: boolean = false
  ): Promise<string> {
    try {
      console.log('[OptimizedApiClient] Generating response with analytical formatting detection');
      
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

      // Enhanced system prompt for analytical queries
      let enhancedSystemPrompt = systemPrompt;
      
      if (isAnalytical) {
        enhancedSystemPrompt += `

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
      const cacheKey = this.generateCacheKey(enhancedSystemPrompt, userPrompt);
      
      // Check cache first
      if (this.responseCache.has(cacheKey)) {
        console.log('[OptimizedApiClient] Cache hit for response');
        return this.responseCache.get(cacheKey)!;
      }

      // Prepare messages with enhanced context
      const messages = [
        { role: 'system', content: enhancedSystemPrompt }
      ];

      // Add conversation context (last 6 messages for better context)
      if (conversationContext.length > 0) {
        messages.push(...conversationContext.slice(-6));
      }

      messages.push({ role: 'user', content: userPrompt });

      // Use intelligent model selection
      const model = isAnalytical || userPrompt.length > 200 ? 
        'gpt-4.1-2025-04-14' : 'gpt-4.1-mini-2025-04-14';
      
      const maxTokens = isAnalytical ? 1000 : 600;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: maxTokens
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.choices[0].message.content;

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
      return result.data[0].embedding;
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
