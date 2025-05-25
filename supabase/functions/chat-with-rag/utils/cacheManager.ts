
// Cache manager for embedding and response caching
export class CacheManager {
  private static embeddingCache = new Map<string, number[]>();
  private static responseCache = new Map<string, { response: string; timestamp: number }>();
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static MAX_CACHE_SIZE = 1000;

  // Cache embeddings to avoid redundant OpenAI calls
  static getCachedEmbedding(text: string): number[] | null {
    const normalizedText = text.toLowerCase().trim();
    return this.embeddingCache.get(normalizedText) || null;
  }

  static setCachedEmbedding(text: string, embedding: number[]): void {
    const normalizedText = text.toLowerCase().trim();
    
    // Implement simple LRU by clearing oldest entries when cache is full
    if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    this.embeddingCache.set(normalizedText, embedding);
  }

  // Cache responses for identical queries
  static getCachedResponse(queryHash: string): string | null {
    const cached = this.responseCache.get(queryHash);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.response;
    }
    
    if (cached) {
      this.responseCache.delete(queryHash);
    }
    
    return null;
  }

  static setCachedResponse(queryHash: string, response: string): void {
    // Clean expired entries
    this.cleanExpiredEntries();
    
    this.responseCache.set(queryHash, {
      response,
      timestamp: Date.now()
    });
  }

  static generateQueryHash(message: string, userId: string, dateFilter?: any): string {
    const hashInput = `${message}:${userId}:${JSON.stringify(dateFilter || {})}`;
    return btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  private static cleanExpiredEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.responseCache.delete(key);
      }
    }
  }

  // Clear all caches
  static clearAll(): void {
    this.embeddingCache.clear();
    this.responseCache.clear();
  }
}

