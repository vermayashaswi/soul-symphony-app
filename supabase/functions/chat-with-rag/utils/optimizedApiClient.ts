
// Optimized API client with connection pooling and caching
export class OptimizedApiClient {
  private static embeddingCache = new Map<string, number[]>();
  private static readonly CACHE_SIZE_LIMIT = 100;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Generate embedding with caching
  static async getEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
    const cacheKey = this.hashString(text);
    
    // Check cache first
    if (this.embeddingCache.has(cacheKey)) {
      console.log('[OptimizedApiClient] Cache hit for embedding');
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      console.log('[OptimizedApiClient] Generating new embedding');
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small', // Faster model
          input: text.substring(0, 8000), // Limit input length
          encoding_format: 'float'
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const result = await response.json();
      const embedding = result.data[0].embedding;

      // Cache the result
      this.cacheEmbedding(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      console.error('[OptimizedApiClient] Embedding generation failed:', error);
      throw error;
    }
  }

  // Optimized chat completion with intelligent model selection
  static async getChatCompletion(
    messages: any[], 
    openaiApiKey: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      useGPT4?: boolean;
    } = {}
  ): Promise<string> {
    const { maxTokens = 800, temperature = 0.7, useGPT4 = false } = options;
    
    // Intelligent model selection based on complexity
    const model = useGPT4 ? 'gpt-4o' : 'gpt-4o-mini';
    
    try {
      console.log(`[OptimizedApiClient] Using model: ${model}`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: this.optimizeMessages(messages),
          temperature,
          max_tokens: maxTokens,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat completion error: ${response.status}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;
    } catch (error) {
      console.error('[OptimizedApiClient] Chat completion failed:', error);
      throw error;
    }
  }

  // Cache management
  private static cacheEmbedding(key: string, embedding: number[]): void {
    // Implement LRU cache behavior
    if (this.embeddingCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    this.embeddingCache.set(key, embedding);
  }

  // Simple hash function for cache keys
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Optimize message array for token efficiency
  private static optimizeMessages(messages: any[]): any[] {
    return messages.map(msg => ({
      ...msg,
      content: typeof msg.content === 'string' 
        ? msg.content.substring(0, 4000) // Limit message length
        : msg.content
    }));
  }

  // Batch embedding generation for multiple texts
  static async getBatchEmbeddings(texts: string[], openaiApiKey: string): Promise<number[][]> {
    const embeddings: number[][] = [];
    const uncachedTexts: { text: string; index: number }[] = [];

    // Check cache for each text
    texts.forEach((text, index) => {
      const cacheKey = this.hashString(text);
      if (this.embeddingCache.has(cacheKey)) {
        embeddings[index] = this.embeddingCache.get(cacheKey)!;
      } else {
        uncachedTexts.push({ text, index });
      }
    });

    // Generate embeddings for uncached texts in batch
    if (uncachedTexts.length > 0) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: uncachedTexts.map(item => item.text.substring(0, 8000)),
            encoding_format: 'float'
          }),
        });

        if (!response.ok) {
          throw new Error(`Batch embedding API error: ${response.status}`);
        }

        const result = await response.json();
        
        // Cache and assign results
        uncachedTexts.forEach((item, batchIndex) => {
          const embedding = result.data[batchIndex].embedding;
          const cacheKey = this.hashString(item.text);
          this.cacheEmbedding(cacheKey, embedding);
          embeddings[item.index] = embedding;
        });
      } catch (error) {
        console.error('[OptimizedApiClient] Batch embedding generation failed:', error);
        throw error;
      }
    }

    return embeddings;
  }
}
