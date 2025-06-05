
// Enhanced cache manager for responses and intermediate results
export class EnhancedCacheManager {
  private static responseCache = new Map<string, { response: string; timestamp: number }>();
  private static queryCache = new Map<string, { results: any[]; timestamp: number }>();
  private static readonly RESPONSE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly QUERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 50;

  // Generate cache key for responses
  static generateQueryHash(
    message: string, 
    userId: string, 
    context: {
      queryPlan?: string;
      useAllEntries?: boolean;
      hasPersonalPronouns?: boolean;
      timeRange?: any;
    } = {}
  ): string {
    const normalized = message.toLowerCase().trim();
    const contextStr = JSON.stringify(context);
    return this.hashString(`${normalized}_${userId}_${contextStr}`);
  }

  // Cache response
  static setCachedResponse(key: string, response: string): void {
    this.cleanupExpiredCache(this.responseCache, this.RESPONSE_CACHE_TTL);
    
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.getOldestKey(this.responseCache);
      if (oldestKey) this.responseCache.delete(oldestKey);
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  // Get cached response
  static getCachedResponse(key: string): string | null {
    const cached = this.responseCache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.RESPONSE_CACHE_TTL) {
      this.responseCache.delete(key);
      return null;
    }

    return cached.response;
  }

  // Cache query results
  static setCachedQueryResults(key: string, results: any[]): void {
    this.cleanupExpiredCache(this.queryCache, this.QUERY_CACHE_TTL);
    
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.getOldestKey(this.queryCache);
      if (oldestKey) this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  // Get cached query results
  static getCachedQueryResults(key: string): any[] | null {
    const cached = this.queryCache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.QUERY_CACHE_TTL) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.results;
  }

  // Cleanup expired cache entries
  private static cleanupExpiredCache(
    cache: Map<string, { timestamp: number }>, 
    ttl: number
  ): void {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > ttl) {
        cache.delete(key);
      }
    }
  }

  // Get oldest cache key for LRU eviction
  private static getOldestKey(cache: Map<string, { timestamp: number }>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  // Simple hash function
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }

  // Clear all caches
  static clearAllCaches(): void {
    this.responseCache.clear();
    this.queryCache.clear();
  }

  // Get cache statistics
  static getCacheStats(): {
    responseCacheSize: number;
    queryCacheSize: number;
    responseCacheHitRate: number;
  } {
    return {
      responseCacheSize: this.responseCache.size,
      queryCacheSize: this.queryCache.size,
      responseCacheHitRate: 0 // Would need hit tracking for accurate rate
    };
  }
}
