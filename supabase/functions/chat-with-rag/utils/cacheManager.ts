
// Enhanced cache manager for dual search operations
export class CacheManager {
  private static queryCache = new Map<string, any>();
  private static embeddingCache = new Map<string, number[]>();
  private static responseCache = new Map<string, string>();
  private static readonly CACHE_SIZE_LIMIT = 100;

  static generateQueryHash(query: string, searchType: string, filters: any): string {
    const hashInput = JSON.stringify({ query, searchType, filters });
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  static getCachedQuery(key: string): any | null {
    if (this.queryCache.has(key)) {
      console.log('[CacheManager] Query cache hit');
      return this.queryCache.get(key);
    }
    return null;
  }

  static setCachedQuery(key: string, result: any): void {
    if (this.queryCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, result);
  }

  static getCachedEmbedding(text: string): number[] | null {
    const key = this.generateTextHash(text);
    if (this.embeddingCache.has(key)) {
      console.log('[CacheManager] Embedding cache hit');
      return this.embeddingCache.get(key)!;
    }
    return null;
  }

  static setCachedEmbedding(text: string, embedding: number[]): void {
    const key = this.generateTextHash(text);
    if (this.embeddingCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    this.embeddingCache.set(key, embedding);
  }

  static getCachedResponse(key: string): string | null {
    if (this.responseCache.has(key)) {
      console.log('[CacheManager] Response cache hit');
      return this.responseCache.get(key);
    }
    return null;
  }

  static setCachedResponse(key: string, response: string): void {
    if (this.responseCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    this.responseCache.set(key, response);
  }

  private static generateTextHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  static clearAllCaches(): void {
    this.queryCache.clear();
    this.embeddingCache.clear();
    this.responseCache.clear();
    console.log('[CacheManager] All caches cleared');
  }
}
