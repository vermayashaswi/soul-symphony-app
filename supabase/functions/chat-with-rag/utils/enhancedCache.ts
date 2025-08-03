// Phase 3: Enhanced Caching Strategy
interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  complexity: string;
  userId: string;
}

export class EnhancedCache {
  private static cache = new Map<string, CacheEntry>();
  private static readonly MAX_SIZE = 1000;
  private static readonly DEFAULT_TTL = 300000; // 5 minutes

  static generateIntelligentKey(
    message: string, 
    userId: string, 
    contextLength: number,
    complexity?: string
  ): string {
    // Create semantic key that captures intent
    const normalizedMessage = message
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 10) // Take first 10 words for semantic similarity
      .join(' ');
    
    const contextBucket = Math.floor(contextLength / 5) * 5; // Group by 5s
    return `${userId}:${normalizedMessage}:ctx${contextBucket}:${complexity || 'standard'}`;
  }

  static set(
    key: string, 
    data: any, 
    customTtl?: number,
    complexity = 'standard',
    userId = 'unknown'
  ): void {
    // Intelligent TTL based on query complexity
    const ttl = customTtl || this.getIntelligentTTL(complexity, data);
    
    // Clean up if cache is getting too large
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      complexity,
      userId
    };

    this.cache.set(key, entry);
    console.log(`[EnhancedCache] Cached with intelligent TTL: ${ttl}ms for complexity: ${complexity}`);
  }

  static get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      console.log(`[EnhancedCache] Expired and removed: ${key}`);
      return null;
    }

    // Update access statistics for LRU
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    console.log(`[EnhancedCache] Cache hit: ${key} (accessed ${entry.accessCount} times)`);
    return entry.data;
  }

  static has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
    console.log('[EnhancedCache] Cache cleared');
  }

  // Intelligent TTL calculation based on query complexity
  private static getIntelligentTTL(complexity: string, data: any): number {
    const baseMultiplier = {
      'simple': 0.5,      // Simple queries cache for less time
      'moderate': 1.0,    // Standard TTL
      'complex': 2.0,     // Complex queries cache longer (expensive to compute)
      'very_complex': 3.0 // Very complex queries cache much longer
    };

    const multiplier = baseMultiplier[complexity] || 1.0;
    
    // Analytical queries typically have longer-lived relevance
    const isAnalytical = data?.analysis?.isAnalyticalQuery || false;
    const analyticalBonus = isAnalytical ? 1.5 : 1.0;
    
    return Math.floor(this.DEFAULT_TTL * multiplier * analyticalBonus);
  }

  // LRU eviction strategy
  private static evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[EnhancedCache] Evicted LRU entry: ${oldestKey}`);
    }
  }

  // Get cache statistics for monitoring
  static getStats(): any {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      entries: entries.length,
      hitRate: this.calculateHitRate(),
      avgTtl: entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length,
      complexityDistribution: this.getComplexityDistribution(entries),
      expired: entries.filter(entry => now - entry.timestamp > entry.ttl).length
    };
  }

  private static calculateHitRate(): number {
    // This would need to be tracked over time for accurate hit rate
    // For now, return a placeholder
    return 0.85; // 85% hit rate assumption
  }

  private static getComplexityDistribution(entries: CacheEntry[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const entry of entries) {
      distribution[entry.complexity] = (distribution[entry.complexity] || 0) + 1;
    }
    
    return distribution;
  }

  // Preemptive cache warming for common queries
  static async warmCache(userId: string, commonQueries: string[]): Promise<void> {
    console.log(`[EnhancedCache] Warming cache for user ${userId} with ${commonQueries.length} queries`);
    
    // This would need to be implemented with actual query processing
    // For now, just log the intent
    for (const query of commonQueries) {
      const key = this.generateIntelligentKey(query, userId, 0, 'simple');
      console.log(`[EnhancedCache] Would warm cache for: ${key}`);
    }
  }
}