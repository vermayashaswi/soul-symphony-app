
/**
 * Optimized API client for external service calls with caching and error handling
 */

export class OptimizedApiClient {
  private static embeddingCache = new Map<string, number[]>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Generate embedding with caching and proper error handling
   */
  static async getEmbedding(text: string, apiKey: string): Promise<number[]> {
    const cacheKey = `embedding_${text.substring(0, 100)}`;
    
    // Check cache first
    if (this.embeddingCache.has(cacheKey)) {
      console.log('[OptimizedApiClient] Using cached embedding');
      return this.embeddingCache.get(cacheKey)!;
    }
    
    try {
      console.log(`[OptimizedApiClient] Generating fresh embedding for text: ${text.substring(0, 100)}...`);
      
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
        console.error('[OptimizedApiClient] OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      if (!embeddingData.data || embeddingData.data.length === 0) {
        throw new Error('Empty embedding data received from OpenAI');
      }

      const embedding = embeddingData.data[0].embedding;
      
      // Validate embedding dimensions
      if (!Array.isArray(embedding) || embedding.length !== 1536) {
        throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding?.length}`);
      }
      
      // Cache the result
      this.embeddingCache.set(cacheKey, embedding);
      
      // Clean old cache entries
      setTimeout(() => this.embeddingCache.delete(cacheKey), this.CACHE_TTL);
      
      console.log('[OptimizedApiClient] Successfully generated and cached embedding');
      return embedding;
      
    } catch (error) {
      console.error('[OptimizedApiClient] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Validate embedding format
   */
  static validateEmbedding(embedding: any): embedding is number[] {
    return Array.isArray(embedding) && 
           embedding.length === 1536 && 
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  }

  /**
   * Clear embedding cache
   */
  static clearEmbeddingCache(): void {
    this.embeddingCache.clear();
    console.log('[OptimizedApiClient] Embedding cache cleared');
  }
}
