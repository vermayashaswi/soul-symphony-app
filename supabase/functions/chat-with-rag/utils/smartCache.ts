// Smart caching system with TTL and compression
interface CacheEntry {
  data: any;
  expiry: number;
  hits: number;
  size: number;
}

export class SmartCache {
  private static cache = new Map<string, CacheEntry>();

  // Generate cache key from request parameters
  static generateKey(message: string, userId: string, contextLength = 0): string {
    const normalized = message.toLowerCase().trim();
    const hash = this.simpleHash(normalized + userId + contextLength);
    return `rag_${hash}`;
  }

  // Check if cached result exists and is valid
  static get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  // Store result with intelligent TTL
  static set(key: string, data: any, baseTtl = 300): void {
    const serialized = JSON.stringify(data);
    const size = new Blob([serialized]).size;
    
    // Adjust TTL based on data complexity and size
    const complexityMultiplier = this.calculateComplexity(data);
    const ttl = Math.min(baseTtl * complexityMultiplier, 1800); // Max 30 min

    const entry: CacheEntry = {
      data,
      expiry: Date.now() + (ttl * 1000),
      hits: 0,
      size
    };

    this.cache.set(key, entry);
    this.evictIfNeeded();
  }

  // Calculate data complexity for TTL adjustment
  private static calculateComplexity(data: any): number {
    const hasAnalysis = data.analysis?.searchMethod === 'dual_parallel' ? 1.5 : 1.0;
    const resultCount = data.referenceEntries?.length || 0;
    const sizeMultiplier = resultCount > 10 ? 1.3 : 1.0;
    
    return hasAnalysis * sizeMultiplier;
  }

  // Simple hash function for cache keys
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Evict old/unused entries when cache gets too large
  private static evictIfNeeded(): void {
    const maxEntries = 100;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (this.cache.size <= maxEntries) {
      return;
    }

    // Sort by last access time and hits
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        score: entry.hits / (Date.now() - (entry.expiry - 300000)) // Hits per minute
      }))
      .sort((a, b) => a.score - b.score);

    // Remove least valuable entries
    const toRemove = entries.slice(0, Math.floor(maxEntries * 0.2));
    toRemove.forEach(({ key }) => this.cache.delete(key));

    console.log(`[SmartCache] Evicted ${toRemove.length} entries`);
  }

  // Get cache statistics
  static getStats(): any {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);

    return {
      entries: this.cache.size,
      totalSize,
      totalHits,
      hitRate: totalHits / Math.max(this.cache.size, 1),
      avgSize: totalSize / Math.max(this.cache.size, 1)
    };
  }

  // Clear expired entries
  static cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Query similarity checker for cache optimization
export class QuerySimilarity {
  // Check if queries are similar enough to use cached results
  static areSimilar(query1: string, query2: string, threshold = 0.8): boolean {
    const normalized1 = this.normalize(query1);
    const normalized2 = this.normalize(query2);
    
    // Simple Jaccard similarity
    const similarity = this.jaccardSimilarity(normalized1, normalized2);
    return similarity >= threshold;
  }

  // Normalize query for comparison
  private static normalize(query: string): Set<string> {
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
    
    return new Set(words);
  }

  // Calculate Jaccard similarity
  private static jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // Basic stop words
  private static isStopWord(word: string): boolean {
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return stopWords.has(word);
  }
}