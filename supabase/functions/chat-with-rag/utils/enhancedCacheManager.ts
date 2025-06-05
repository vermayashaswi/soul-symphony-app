
/**
 * Enhanced Cache Manager with performance optimizations and LRU eviction
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
}

export class EnhancedCacheManager {
  private static embeddingCache = new Map<string, CacheEntry<number[]>>();
  private static responseCache = new Map<string, CacheEntry<string>>();
  private static queryPlanCache = new Map<string, CacheEntry<any>>();
  private static searchResultsCache = new Map<string, CacheEntry<any[]>>();
  
  private static readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static readonly MAX_EMBEDDING_CACHE_SIZE = 1000; // entries
  private static readonly MAX_RESPONSE_CACHE_SIZE = 500; // entries
  private static readonly MAX_QUERY_PLAN_CACHE_SIZE = 200; // entries
  private static readonly MAX_SEARCH_CACHE_SIZE = 300; // entries
  private static readonly MAX_MEMORY_SIZE = 50 * 1024 * 1024; // 50MB
  
  private static stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0
  };

  // Embedding cache with LRU eviction
  static getCachedEmbedding(text: string): number[] | null {
    const normalizedText = this.normalizeText(text);
    const entry = this.embeddingCache.get(normalizedText);
    
    if (entry && this.isEntryValid(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.data;
    }
    
    if (entry) {
      this.embeddingCache.delete(normalizedText);
      this.updateStatsOnDelete(entry);
    }
    
    this.stats.misses++;
    return null;
  }

  static setCachedEmbedding(text: string, embedding: number[]): void {
    const normalizedText = this.normalizeText(text);
    const size = this.estimateEmbeddingSize(embedding);
    
    // Check if we need to evict before adding
    this.ensureCacheSpace('embedding', size);
    
    const entry: CacheEntry<number[]> = {
      data: embedding,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size
    };
    
    this.embeddingCache.set(normalizedText, entry);
    this.updateStatsOnAdd(entry);
  }

  // Response cache with size-aware eviction
  static getCachedResponse(queryHash: string): string | null {
    const entry = this.responseCache.get(queryHash);
    
    if (entry && this.isEntryValid(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.data;
    }
    
    if (entry) {
      this.responseCache.delete(queryHash);
      this.updateStatsOnDelete(entry);
    }
    
    this.stats.misses++;
    return null;
  }

  static setCachedResponse(queryHash: string, response: string): void {
    const size = this.estimateStringSize(response);
    
    // Don't cache extremely large responses
    if (size > 1024 * 1024) { // 1MB limit
      return;
    }
    
    this.ensureCacheSpace('response', size);
    
    const entry: CacheEntry<string> = {
      data: response,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size
    };
    
    this.responseCache.set(queryHash, entry);
    this.updateStatsOnAdd(entry);
  }

  // Query plan cache for intelligent planning
  static getCachedQueryPlan(planKey: string): any | null {
    const entry = this.queryPlanCache.get(planKey);
    
    if (entry && this.isEntryValid(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.data;
    }
    
    if (entry) {
      this.queryPlanCache.delete(planKey);
      this.updateStatsOnDelete(entry);
    }
    
    this.stats.misses++;
    return null;
  }

  static setCachedQueryPlan(planKey: string, plan: any): void {
    const size = this.estimateObjectSize(plan);
    
    this.ensureCacheSpace('queryPlan', size);
    
    const entry: CacheEntry<any> = {
      data: plan,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size
    };
    
    this.queryPlanCache.set(planKey, entry);
    this.updateStatsOnAdd(entry);
  }

  // Search results cache
  static getCachedSearchResults(searchKey: string): any[] | null {
    const entry = this.searchResultsCache.get(searchKey);
    
    if (entry && this.isEntryValid(entry)) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.data;
    }
    
    if (entry) {
      this.searchResultsCache.delete(searchKey);
      this.updateStatsOnDelete(entry);
    }
    
    this.stats.misses++;
    return null;
  }

  static setCachedSearchResults(searchKey: string, results: any[]): void {
    const size = this.estimateObjectSize(results);
    
    // Don't cache extremely large result sets
    if (size > 2 * 1024 * 1024) { // 2MB limit
      return;
    }
    
    this.ensureCacheSpace('searchResults', size);
    
    const entry: CacheEntry<any[]> = {
      data: results,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size
    };
    
    this.searchResultsCache.set(searchKey, entry);
    this.updateStatsOnAdd(entry);
  }

  // Enhanced query hash generation with complexity awareness
  static generateQueryHash(message: string, userId: string, options: any = {}): string {
    const complexity = options.complexity || 'standard';
    const timeRange = options.timeRange || null;
    const entities = options.entities || [];
    const emotions = options.emotions || [];
    
    const hashInput = JSON.stringify({
      message: message.toLowerCase().trim(),
      userId,
      complexity,
      timeRange,
      entities: entities.sort(),
      emotions: emotions.sort(),
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets
    });
    
    return this.fastHash(hashInput);
  }

  // Performance monitoring
  static getCacheStats(): CacheStats & {
    hitRate: number;
    cacheDistribution: Record<string, number>;
  } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    return {
      ...this.stats,
      hitRate,
      cacheDistribution: {
        embeddings: this.embeddingCache.size,
        responses: this.responseCache.size,
        queryPlans: this.queryPlanCache.size,
        searchResults: this.searchResultsCache.size
      }
    };
  }

  // Cache management utilities
  private static normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private static isEntryValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  private static ensureCacheSpace(cacheType: string, newEntrySize: number): void {
    let targetCache: Map<string, CacheEntry<any>>;
    let maxSize: number;
    
    switch (cacheType) {
      case 'embedding':
        targetCache = this.embeddingCache;
        maxSize = this.MAX_EMBEDDING_CACHE_SIZE;
        break;
      case 'response':
        targetCache = this.responseCache;
        maxSize = this.MAX_RESPONSE_CACHE_SIZE;
        break;
      case 'queryPlan':
        targetCache = this.queryPlanCache;
        maxSize = this.MAX_QUERY_PLAN_CACHE_SIZE;
        break;
      case 'searchResults':
        targetCache = this.searchResultsCache;
        maxSize = this.MAX_SEARCH_CACHE_SIZE;
        break;
      default:
        return;
    }
    
    // Check memory pressure
    if (this.stats.totalSize + newEntrySize > this.MAX_MEMORY_SIZE) {
      this.evictLeastUsed(targetCache, Math.ceil(targetCache.size * 0.2)); // Evict 20%
    }
    
    // Check size limits
    while (targetCache.size >= maxSize) {
      this.evictLeastUsed(targetCache, 1);
    }
  }

  private static evictLeastUsed<T>(cache: Map<string, CacheEntry<T>>, count: number): void {
    const entries = Array.from(cache.entries())
      .sort(([, a], [, b]) => {
        // Sort by access frequency and recency
        const scoreA = a.accessCount * 0.7 + (Date.now() - a.lastAccessed) * 0.3;
        const scoreB = b.accessCount * 0.7 + (Date.now() - b.lastAccessed) * 0.3;
        return scoreA - scoreB;
      });
    
    for (let i = 0; i < count && i < entries.length; i++) {
      const [key, entry] = entries[i];
      cache.delete(key);
      this.updateStatsOnDelete(entry);
      this.stats.evictions++;
    }
  }

  private static updateStatsOnAdd<T>(entry: CacheEntry<T>): void {
    this.stats.totalSize += entry.size;
    this.stats.entryCount++;
  }

  private static updateStatsOnDelete<T>(entry: CacheEntry<T>): void {
    this.stats.totalSize -= entry.size;
    this.stats.entryCount--;
  }

  private static estimateEmbeddingSize(embedding: number[]): number {
    return embedding.length * 8; // 8 bytes per float64
  }

  private static estimateStringSize(str: string): number {
    return str.length * 2; // Rough estimate for UTF-16
  }

  private static estimateObjectSize(obj: any): number {
    return JSON.stringify(obj).length * 2;
  }

  private static fastHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Cleanup expired entries
  static cleanupExpired(): void {
    const now = Date.now();
    const caches = [
      this.embeddingCache,
      this.responseCache,
      this.queryPlanCache,
      this.searchResultsCache
    ];
    
    caches.forEach(cache => {
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > this.CACHE_TTL) {
          cache.delete(key);
          this.updateStatsOnDelete(entry);
        }
      }
    });
  }

  // Clear all caches
  static clearAll(): void {
    this.embeddingCache.clear();
    this.responseCache.clear();
    this.queryPlanCache.clear();
    this.searchResultsCache.clear();
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0
    };
  }
}
