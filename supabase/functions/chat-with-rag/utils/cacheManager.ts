
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
    
    try {
      // Use UTF-8 safe encoding instead of btoa()
      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      
      // Convert to base64 manually for UTF-8 safety
      const base64 = this.arrayBufferToBase64(data);
      return base64.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    } catch (error) {
      console.error('[CacheManager] Error generating hash:', error);
      // Fallback to simple hash if encoding fails
      return this.simpleHash(hashInput).substring(0, 32);
    }
  }

  private static arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
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
