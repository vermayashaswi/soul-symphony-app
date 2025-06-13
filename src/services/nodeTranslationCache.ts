
import { translationCache } from './translationCache';

interface NodeTranslationEntry {
  nodeId: string;
  originalText: string;
  translatedText: string;
  language: string;
  timestamp: number;
  version: number;
}

class NodeTranslationCacheService {
  private static readonly CACHE_KEY_PREFIX = 'node-translation';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static cache = new Map<string, NodeTranslationEntry>();

  // Generate language-independent cache key for node translations
  private static getNodeCacheKey(nodeId: string, language: string): string {
    return `${this.CACHE_KEY_PREFIX}-${nodeId}-${language}`;
  }

  // Get cached translation for a specific node
  static async getCachedNodeTranslation(nodeId: string, language: string): Promise<string | null> {
    if (language === 'en') {
      return nodeId; // Return original for English
    }

    const cacheKey = this.getNodeCacheKey(nodeId, language);
    
    // Check memory cache first
    const memoryEntry = this.cache.get(cacheKey);
    if (memoryEntry && (Date.now() - memoryEntry.timestamp) < this.CACHE_DURATION) {
      console.log(`[NodeTranslationCache] Memory hit for node: ${nodeId} -> ${memoryEntry.translatedText}`);
      return memoryEntry.translatedText;
    }

    // Check persistent translation cache
    const persistentEntry = await translationCache.getTranslation(nodeId, language);
    if (persistentEntry) {
      console.log(`[NodeTranslationCache] Persistent hit for node: ${nodeId} -> ${persistentEntry.translatedText}`);
      
      // Update memory cache
      this.cache.set(cacheKey, {
        nodeId,
        originalText: nodeId,
        translatedText: persistentEntry.translatedText,
        language,
        timestamp: persistentEntry.timestamp,
        version: persistentEntry.version
      });
      
      return persistentEntry.translatedText;
    }

    console.log(`[NodeTranslationCache] No cache found for node: ${nodeId} in language: ${language}`);
    return null;
  }

  // Store node translation in cache
  static async setCachedNodeTranslation(
    nodeId: string, 
    translatedText: string, 
    language: string
  ): Promise<void> {
    if (language === 'en') {
      return; // Don't cache English translations
    }

    const cacheKey = this.getNodeCacheKey(nodeId, language);
    const entry: NodeTranslationEntry = {
      nodeId,
      originalText: nodeId,
      translatedText,
      language,
      timestamp: Date.now(),
      version: 1
    };

    // Store in memory cache
    this.cache.set(cacheKey, entry);

    // Store in persistent cache
    await translationCache.setTranslation({
      originalText: nodeId,
      translatedText,
      language,
      timestamp: entry.timestamp,
      version: entry.version
    });

    console.log(`[NodeTranslationCache] Cached translation for node: ${nodeId} -> ${translatedText}`);
  }

  // Get multiple cached translations at once
  static async getBatchCachedTranslations(
    nodeIds: string[], 
    language: string
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (language === 'en') {
      nodeIds.forEach(nodeId => results.set(nodeId, nodeId));
      return results;
    }

    const cachePromises = nodeIds.map(async (nodeId) => {
      const translation = await this.getCachedNodeTranslation(nodeId, language);
      return { nodeId, translation };
    });

    const cacheResults = await Promise.all(cachePromises);
    
    cacheResults.forEach(({ nodeId, translation }) => {
      if (translation) {
        results.set(nodeId, translation);
      }
    });

    console.log(`[NodeTranslationCache] Batch cache lookup: ${results.size}/${nodeIds.length} nodes found`);
    return results;
  }

  // Store multiple translations at once
  static async setBatchCachedTranslations(
    translations: Map<string, string>, 
    language: string
  ): Promise<void> {
    if (language === 'en') {
      return;
    }

    const setPromises = Array.from(translations.entries()).map(([nodeId, translatedText]) =>
      this.setCachedNodeTranslation(nodeId, translatedText, language)
    );

    await Promise.all(setPromises);
    console.log(`[NodeTranslationCache] Batch cached ${translations.size} node translations`);
  }

  // Clear cache for specific language or all
  static clearCache(language?: string): void {
    if (language) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(`-${language}`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`[NodeTranslationCache] Cleared cache for language: ${language}`);
    } else {
      this.cache.clear();
      console.log('[NodeTranslationCache] Cleared all node translation cache');
    }
  }

  // Get cache statistics
  static getCacheStats(): { totalEntries: number, languages: string[] } {
    const languages = new Set<string>();
    Array.from(this.cache.values()).forEach(entry => {
      languages.add(entry.language);
    });

    return {
      totalEntries: this.cache.size,
      languages: Array.from(languages)
    };
  }
}

export { NodeTranslationCacheService };
