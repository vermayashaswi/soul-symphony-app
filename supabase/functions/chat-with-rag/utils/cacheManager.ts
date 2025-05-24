
// Simple in-memory cache for embeddings and query plans
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  set(key: string, data: T, ttlMs: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Cache instances
const embeddingCache = new SimpleCache<number[]>();
const emotionDataCache = new SimpleCache<any>();
const queryPlanCache = new SimpleCache<any>();

export class CacheManager {
  // Embedding cache methods
  static getCachedEmbedding(query: string): number[] | null {
    const normalizedQuery = query.toLowerCase().trim();
    return embeddingCache.get(normalizedQuery);
  }
  
  static setCachedEmbedding(query: string, embedding: number[]): void {
    const normalizedQuery = query.toLowerCase().trim();
    embeddingCache.set(normalizedQuery, embedding, 600000); // 10 minutes for embeddings
    console.log(`[cache] Cached embedding for query: "${normalizedQuery}"`);
  }
  
  // Emotion data cache methods
  static getCachedEmotionData(userId: string, dateKey: string): any | null {
    const cacheKey = `${userId}:${dateKey}`;
    return emotionDataCache.get(cacheKey);
  }
  
  static setCachedEmotionData(userId: string, dateKey: string, data: any): void {
    const cacheKey = `${userId}:${dateKey}`;
    emotionDataCache.set(cacheKey, data, 300000); // 5 minutes for emotion data
    console.log(`[cache] Cached emotion data for user: ${userId.substring(0, 8)}...`);
  }
  
  // Query plan cache methods
  static getCachedQueryPlan(querySignature: string): any | null {
    return queryPlanCache.get(querySignature);
  }
  
  static setCachedQueryPlan(querySignature: string, plan: any): void {
    queryPlanCache.set(querySignature, plan, 900000); // 15 minutes for query plans
    console.log(`[cache] Cached query plan for signature: ${querySignature}`);
  }
  
  // Utility methods
  static generateQuerySignature(message: string, hasPersonalPronouns: boolean, hasTimeRef: boolean): string {
    // Create a signature based on query characteristics
    const messageHash = message.toLowerCase().replace(/[^\w\s]/g, '').substring(0, 50);
    return `${messageHash}:${hasPersonalPronouns}:${hasTimeRef}`;
  }
  
  static generateDateKey(startDate?: string, endDate?: string): string {
    if (!startDate && !endDate) return 'all_time';
    return `${startDate || 'null'}_${endDate || 'null'}`;
  }
  
  // Cache statistics
  static getCacheStats(): object {
    return {
      embeddingCache: embeddingCache.size(),
      emotionDataCache: emotionDataCache.size(),
      queryPlanCache: queryPlanCache.size(),
      timestamp: new Date().toISOString()
    };
  }
  
  // Clear all caches
  static clearAllCaches(): void {
    embeddingCache.clear();
    emotionDataCache.clear();
    queryPlanCache.clear();
    console.log(`[cache] All caches cleared`);
  }
}
