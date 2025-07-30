import { translationCache } from './translationCache';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface CacheEntry {
  text: string;
  translation: string;
  language: string;
  timestamp: number;
  source: 'idb' | 'memory' | 'api';
}

class GlobalTranslationCache {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MAX_MEMORY_CACHE_SIZE = 1000;

  private generateKey(text: string, language: string): string {
    return `${language}:${text.substring(0, 100)}`;
  }

  /**
   * Get translation from any available cache (memory, localStorage, IndexedDB)
   */
  async getTranslation(text: string, targetLanguage: string): Promise<string | null> {
    const key = this.generateKey(text, targetLanguage);

    // 1. Check memory cache first (fastest)
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) {
      return memoryCached.translation;
    }

    // 2. Check localStorage cache (onDemandTranslationCache)
    const localStorageCached = onDemandTranslationCache.get(targetLanguage, text);
    if (localStorageCached) {
      // Promote to memory cache
      this.setMemoryCache(text, localStorageCached, targetLanguage, 'memory');
      return localStorageCached;
    }

    // 3. Check IndexedDB cache (translationCache)
    try {
      const idbCached = await translationCache.getTranslation(text, targetLanguage);
      if (idbCached) {
        // Promote to memory and localStorage caches
        this.setMemoryCache(text, idbCached.translatedText, targetLanguage, 'idb');
        onDemandTranslationCache.set(targetLanguage, text, idbCached.translatedText);
        return idbCached.translatedText;
      }
    } catch (error) {
      console.warn('[GlobalTranslationCache] Error accessing IndexedDB cache:', error);
    }

    return null;
  }

  /**
   * Set translation in all cache layers
   */
  async setTranslation(text: string, translation: string, targetLanguage: string): Promise<void> {
    // Set in memory cache
    this.setMemoryCache(text, translation, targetLanguage, 'api');

    // Set in localStorage cache
    onDemandTranslationCache.set(targetLanguage, text, translation);

    // Set in IndexedDB cache
    try {
      await translationCache.setTranslation({
        originalText: text,
        translatedText: translation,
        language: targetLanguage,
        timestamp: Date.now(),
        version: 1
      });
    } catch (error) {
      console.warn('[GlobalTranslationCache] Error setting IndexedDB cache:', error);
    }
  }

  /**
   * Clear all caches for a specific language
   */
  async clearLanguage(language: string): Promise<void> {
    // Clear memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.language === language) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage cache
    onDemandTranslationCache.clearLanguage(language);

    // Clear IndexedDB cache
    try {
      await translationCache.clearCache(language);
    } catch (error) {
      console.warn('[GlobalTranslationCache] Error clearing IndexedDB cache:', error);
    }
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear localStorage cache
    onDemandTranslationCache.clearAll();

    // Clear IndexedDB cache - get all translations first then clear by language
    try {
      const allTranslations = await translationCache.getAllTranslations();
      const languages = [...new Set(allTranslations.map(t => t.language))];
      
      for (const language of languages) {
        await translationCache.clearCache(language);
      }
    } catch (error) {
      console.warn('[GlobalTranslationCache] Error clearing IndexedDB cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    memoryEntries: number;
    localStorageEntries: number;
    indexedDBEntries: number;
  }> {
    let indexedDBEntries = 0;
    try {
      const allTranslations = await translationCache.getAllTranslations();
      indexedDBEntries = allTranslations.length;
    } catch (error) {
      console.warn('[GlobalTranslationCache] Error getting IndexedDB stats:', error);
    }

    return {
      memoryEntries: this.memoryCache.size,
      localStorageEntries: this.getLocalStorageEntryCount(),
      indexedDBEntries
    };
  }

  private setMemoryCache(text: string, translation: string, language: string, source: 'idb' | 'memory' | 'api'): void {
    const key = this.generateKey(text, language);
    
    // If cache is full, remove oldest entries
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      this.evictOldestEntries();
    }

    this.memoryCache.set(key, {
      text,
      translation,
      language,
      timestamp: Date.now(),
      source
    });
  }

  private evictOldestEntries(): void {
    // Remove 20% of entries (oldest first)
    const entriesToRemove = Math.floor(this.MAX_MEMORY_CACHE_SIZE * 0.2);
    const sortedEntries = [...this.memoryCache.entries()].sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    for (let i = 0; i < entriesToRemove; i++) {
      const [key] = sortedEntries[i];
      this.memoryCache.delete(key);
    }
  }

  private getLocalStorageEntryCount(): number {
    try {
      const stored = localStorage.getItem('translation-cache');
      if (stored) {
        const cache = JSON.parse(stored);
        return Object.keys(cache).length;
      }
    } catch (error) {
      console.warn('[GlobalTranslationCache] Error reading localStorage cache:', error);
    }
    return 0;
  }

  /**
   * Preload translations for a list of texts
   */
  async preloadTranslations(texts: string[], targetLanguage: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const text of texts) {
      const cached = await this.getTranslation(text, targetLanguage);
      if (cached) {
        results.set(text, cached);
      }
    }

    return results;
  }
}

export const globalTranslationCache = new GlobalTranslationCache();