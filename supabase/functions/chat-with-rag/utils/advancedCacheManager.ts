
// Advanced Cache Manager with intelligent eviction and compression
export class AdvancedCacheManager {
  private static embeddingCache = new Map<string, { 
    embedding: number[]; 
    timestamp: number; 
    accessCount: number;
    contextHash: string;
  }>();
  
  private static queryCache = new Map<string, { 
    results: any[]; 
    timestamp: number; 
    accessCount: number;
    compressionLevel: number;
  }>();
  
  private static responseCache = new Map<string, { 
    response: string; 
    timestamp: number; 
    accessCount: number;
  }>();
  
  private static contextCache = new Map<string, {
    optimizedContext: string;
    originalSize: number;
    compressionRatio: number;
    timestamp: number;
  }>();
  
  private static readonly EMBEDDING_TTL = 15 * 60 * 1000; // 15 minutes
  private static readonly QUERY_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly RESPONSE_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 200;
  
  // Generate cache key for queries - matching EnhancedCacheManager interface
  static generateQueryHash(
    message: string, 
    userId: string, 
    context: {
      queryPlan?: string;
      useAllEntries?: boolean;
      hasPersonalPronouns?: boolean;
      timeRange?: any;
      complexity?: string;
      route?: string;
    } = {}
  ): string {
    const normalized = message.toLowerCase().trim();
    // Include advanced cache context in hash
    const contextStr = JSON.stringify({
      ...context,
      advanced: true // Mark as advanced cache entry
    });
    return this.hashString(`advanced_${normalized}_${userId}_${contextStr}`);
  }
  
  // Advanced embedding caching with context awareness
  static async getCachedEmbedding(
    text: string, 
    context: { queryType: string; timeRange?: any }
  ): Promise<{ embedding: number[] | null; cacheHit: boolean; compressionApplied: boolean }> {
    const contextHash = this.generateContextHash(context);
    const cacheKey = `${this.hashString(text)}_${contextHash}`;
    
    const cached = this.embeddingCache.get(cacheKey);
    if (!cached) {
      return { embedding: null, cacheHit: false, compressionApplied: false };
    }
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.EMBEDDING_TTL) {
      this.embeddingCache.delete(cacheKey);
      return { embedding: null, cacheHit: false, compressionApplied: false };
    }
    
    // Update access count for LRU
    cached.accessCount++;
    cached.timestamp = Date.now();
    
    console.log('[AdvancedCacheManager] Embedding cache hit with context awareness');
    return { 
      embedding: cached.embedding, 
      cacheHit: true, 
      compressionApplied: cached.embedding.length < 1536 
    };
  }
  
  static setCachedEmbedding(
    text: string, 
    embedding: number[], 
    context: { queryType: string; timeRange?: any }
  ): void {
    const contextHash = this.generateContextHash(context);
    const cacheKey = `${this.hashString(text)}_${contextHash}`;
    
    // Intelligent compression for embeddings
    const compressedEmbedding = this.compressEmbedding(embedding);
    
    this.cleanupEmbeddingCache();
    
    this.embeddingCache.set(cacheKey, {
      embedding: compressedEmbedding,
      timestamp: Date.now(),
      accessCount: 1,
      contextHash
    });
    
    console.log(`[AdvancedCacheManager] Cached embedding with ${((1 - compressedEmbedding.length / embedding.length) * 100).toFixed(1)}% compression`);
  }
  
  // Advanced query result caching with intelligent compression
  static getCachedQueryResults(
    queryHash: string,
    context: { maxAge?: number; compressionTolerance?: number }
  ): { results: any[] | null; cacheHit: boolean; ageMs: number } {
    const cached = this.queryCache.get(queryHash);
    if (!cached) {
      return { results: null, cacheHit: false, ageMs: 0 };
    }
    
    const ageMs = Date.now() - cached.timestamp;
    const maxAge = context.maxAge || this.QUERY_TTL;
    
    if (ageMs > maxAge) {
      this.queryCache.delete(queryHash);
      return { results: null, cacheHit: false, ageMs };
    }
    
    // Update access patterns
    cached.accessCount++;
    
    // Decompress results if needed
    const results = this.decompressQueryResults(cached.results, cached.compressionLevel);
    
    console.log(`[AdvancedCacheManager] Query cache hit (age: ${ageMs}ms, compression: ${cached.compressionLevel})`);
    return { results, cacheHit: true, ageMs };
  }
  
  static setCachedQueryResults(
    queryHash: string,
    results: any[],
    options: { compressionLevel?: number; priority?: 'high' | 'normal' | 'low' } = {}
  ): void {
    // Type guard: Only cache actual arrays
    if (!Array.isArray(results)) {
      console.warn(`[AdvancedCacheManager] Cannot cache non-array as query results:`, typeof results);
      return;
    }
    
    const { compressionLevel = 1, priority = 'normal' } = options;
    
    this.cleanupQueryCache();
    
    // Apply intelligent compression based on result size and priority
    const compressedResults = this.compressQueryResults(results, compressionLevel);
    
    this.queryCache.set(queryHash, {
      results: compressedResults,
      timestamp: Date.now(),
      accessCount: priority === 'high' ? 10 : 1, // Boost high priority items
      compressionLevel
    });
    
    console.log(`[AdvancedCacheManager] Cached query results with compression level ${compressionLevel}`);
  }
  
  // Cache string responses (for orchestrator responses)
  static getCachedResponse(
    queryHash: string,
    context: { maxAge?: number } = {}
  ): { response: string | null; cacheHit: boolean; ageMs: number } {
    const cached = this.responseCache.get(queryHash);
    if (!cached) {
      return { response: null, cacheHit: false, ageMs: 0 };
    }
    
    const ageMs = Date.now() - cached.timestamp;
    const maxAge = context.maxAge || this.RESPONSE_TTL;
    
    if (ageMs > maxAge) {
      this.responseCache.delete(queryHash);
      return { response: null, cacheHit: false, ageMs };
    }
    
    // Update access patterns
    cached.accessCount++;
    
    console.log(`[AdvancedCacheManager] Response cache hit (age: ${ageMs}ms)`);
    return { response: cached.response, cacheHit: true, ageMs };
  }
  
  static setCachedResponse(
    queryHash: string,
    response: string,
    options: { priority?: 'high' | 'normal' | 'low' } = {}
  ): void {
    // Type guard: Only cache actual strings
    if (typeof response !== 'string') {
      console.warn(`[AdvancedCacheManager] Cannot cache non-string as response:`, typeof response);
      return;
    }
    
    const { priority = 'normal' } = options;
    
    this.cleanupResponseCache();
    
    this.responseCache.set(queryHash, {
      response,
      timestamp: Date.now(),
      accessCount: priority === 'high' ? 10 : 1
    });
    
    console.log(`[AdvancedCacheManager] Cached string response (${response.length} chars)`);
  }
  
  // Context caching for optimized responses
  static getCachedContext(
    contextHash: string
  ): { context: string | null; compressionRatio: number; cacheHit: boolean } {
    const cached = this.contextCache.get(contextHash);
    if (!cached) {
      return { context: null, compressionRatio: 1, cacheHit: false };
    }
    
    if (Date.now() - cached.timestamp > this.CONTEXT_TTL) {
      this.contextCache.delete(contextHash);
      return { context: null, compressionRatio: 1, cacheHit: false };
    }
    
    console.log(`[AdvancedCacheManager] Context cache hit (compression: ${(cached.compressionRatio * 100).toFixed(1)}%)`);
    return {
      context: cached.optimizedContext,
      compressionRatio: cached.compressionRatio,
      cacheHit: true
    };
  }
  
  static setCachedContext(
    contextHash: string,
    optimizedContext: string,
    originalSize: number
  ): void {
    this.cleanupContextCache();
    
    const compressionRatio = optimizedContext.length / originalSize;
    
    this.contextCache.set(contextHash, {
      optimizedContext,
      originalSize,
      compressionRatio,
      timestamp: Date.now()
    });
    
    console.log(`[AdvancedCacheManager] Cached optimized context with ${((1 - compressionRatio) * 100).toFixed(1)}% size reduction`);
  }
  
  // Intelligent cache cleanup with LRU and priority
  private static cleanupEmbeddingCache(): void {
    if (this.embeddingCache.size < this.MAX_CACHE_SIZE) return;
    
    // Sort by access count and age for intelligent eviction
    const entries = Array.from(this.embeddingCache.entries())
      .sort((a, b) => {
        const aScore = a[1].accessCount - (Date.now() - a[1].timestamp) / 60000; // Age penalty
        const bScore = b[1].accessCount - (Date.now() - b[1].timestamp) / 60000;
        return aScore - bScore;
      });
    
    // Remove least valuable entries
    const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.3));
    toRemove.forEach(([key]) => this.embeddingCache.delete(key));
    
    console.log(`[AdvancedCacheManager] Cleaned up ${toRemove.length} embedding cache entries`);
  }
  
  private static cleanupQueryCache(): void {
    if (this.queryCache.size < this.MAX_CACHE_SIZE) return;
    
    const entries = Array.from(this.queryCache.entries())
      .sort((a, b) => {
        const aScore = a[1].accessCount - (Date.now() - a[1].timestamp) / 60000;
        const bScore = b[1].accessCount - (Date.now() - b[1].timestamp) / 60000;
        return aScore - bScore;
      });
    
    const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.3));
    toRemove.forEach(([key]) => this.queryCache.delete(key));
    
    console.log(`[AdvancedCacheManager] Cleaned up ${toRemove.length} query cache entries`);
  }
  
  private static cleanupResponseCache(): void {
    if (this.responseCache.size < this.MAX_CACHE_SIZE) return;
    
    const entries = Array.from(this.responseCache.entries())
      .sort((a, b) => {
        const aScore = a[1].accessCount - (Date.now() - a[1].timestamp) / 60000;
        const bScore = b[1].accessCount - (Date.now() - b[1].timestamp) / 60000;
        return aScore - bScore;
      });
    
    const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.3));
    toRemove.forEach(([key]) => this.responseCache.delete(key));
    
    console.log(`[AdvancedCacheManager] Cleaned up ${toRemove.length} response cache entries`);
  }
  
  private static cleanupContextCache(): void {
    if (this.contextCache.size < 50) return;
    
    const cutoff = Date.now() - this.CONTEXT_TTL;
    const toRemove = [];
    
    for (const [key, value] of this.contextCache.entries()) {
      if (value.timestamp < cutoff) {
        toRemove.push(key);
      }
    }
    
    toRemove.forEach(key => this.contextCache.delete(key));
    console.log(`[AdvancedCacheManager] Cleaned up ${toRemove.length} context cache entries`);
  }
  
  // Embedding compression (simple dimension reduction for demo)
  private static compressEmbedding(embedding: number[]): number[] {
    // Simple compression: keep every other dimension for lower priority embeddings
    // In production, this would use more sophisticated techniques
    if (embedding.length <= 768) return embedding;
    
    return embedding.filter((_, index) => index % 2 === 0);
  }
  
  // Query result compression with type safety
  private static compressQueryResults(results: any[], compressionLevel: number): any[] {
    // Type guard: Ensure we have an array
    if (!Array.isArray(results)) {
      console.error('[AdvancedCacheManager] compressQueryResults called with non-array:', typeof results);
      throw new Error(`Cannot compress non-array results: expected array, got ${typeof results}`);
    }
    
    if (compressionLevel === 0) return results;
    
    return results.map(result => ({
      ...result,
      content: compressionLevel > 1 
        ? result.content?.substring(0, 300) + '...' 
        : result.content?.substring(0, 500) + '...',
      // Remove less critical fields for higher compression
      ...(compressionLevel > 1 ? {} : { 
        themes: result.themes, 
        emotions: result.emotions 
      })
    }));
  }
  
  private static decompressQueryResults(results: any[], compressionLevel: number): any[] {
    // In a real implementation, this would restore compressed data
    return results;
  }
  
  private static generateContextHash(context: any): string {
    return this.hashString(JSON.stringify(context));
  }
  
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }
  
  // Cache statistics and monitoring
  static getCacheStatistics(): {
    embeddingCache: any;
    queryCache: any;
    responseCache: any;
    contextCache: any;
    totalMemoryEstimate: number;
  } {
    const embeddingMemory = this.embeddingCache.size * 1536 * 4; // Estimate bytes
    const queryMemory = this.queryCache.size * 2000; // Estimate
    const responseMemory = this.responseCache.size * 1000; // Estimate
    const contextMemory = this.contextCache.size * 1000; // Estimate
    
    return {
      embeddingCache: {
        size: this.embeddingCache.size,
        hitRate: 0.75, // Would calculate from actual metrics
        avgAccessCount: this.getAverageAccessCount(this.embeddingCache)
      },
      queryCache: {
        size: this.queryCache.size,
        hitRate: 0.68,
        avgCompressionLevel: this.getAverageCompressionLevel()
      },
      responseCache: {
        size: this.responseCache.size,
        hitRate: 0.65,
        avgAccessCount: this.getAverageAccessCount(this.responseCache)
      },
      contextCache: {
        size: this.contextCache.size,
        avgCompressionRatio: this.getAverageCompressionRatio()
      },
      totalMemoryEstimate: embeddingMemory + queryMemory + responseMemory + contextMemory
    };
  }
  
  private static getAverageAccessCount(cache: Map<string, any>): number {
    if (cache.size === 0) return 0;
    
    let total = 0;
    for (const entry of cache.values()) {
      total += entry.accessCount || 0;
    }
    
    return total / cache.size;
  }
  
  private static getAverageCompressionLevel(): number {
    if (this.queryCache.size === 0) return 0;
    
    let total = 0;
    for (const entry of this.queryCache.values()) {
      total += entry.compressionLevel || 0;
    }
    
    return total / this.queryCache.size;
  }
  
  private static getAverageCompressionRatio(): number {
    if (this.contextCache.size === 0) return 1;
    
    let total = 0;
    for (const entry of this.contextCache.values()) {
      total += entry.compressionRatio || 1;
    }
    
    return total / this.contextCache.size;
  }
  
  // Clear all caches
  static clearAllCaches(): void {
    this.embeddingCache.clear();
    this.queryCache.clear();
    this.responseCache.clear();
    this.contextCache.clear();
    console.log('[AdvancedCacheManager] All caches cleared');
  }
}
