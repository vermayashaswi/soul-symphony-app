
import { translationService } from './translationService';
import { supabase } from '@/integrations/supabase/client';

interface NodeTranslation {
  text: string;
  translatedText: string;
  language: string;
  timestamp: number;
  source: 'coordinated' | 'app-level' | 'direct';
}

interface CacheEntry {
  translations: Map<string, NodeTranslation>;
  lastUpdated: number;
  isComplete: boolean;
}

class NodeTranslationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly STORAGE_KEY = 'soulo-node-translation-cache';

  constructor() {
    this.loadFromStorage();
  }

  // Generate cache key for user/timeRange/language combination
  private getCacheKey(userId: string, timeRange: string, language: string): string {
    return `${userId}-${timeRange}-${language}`;
  }

  // Load cache from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          const translations = new Map<string, NodeTranslation>();
          if (value.translations) {
            Object.entries(value.translations).forEach(([nodeId, translation]: [string, any]) => {
              translations.set(nodeId, translation);
            });
          }
          this.cache.set(key, {
            translations,
            lastUpdated: value.lastUpdated || 0,
            isComplete: value.isComplete || false
          });
        });
        console.log(`[NodeTranslationCache] Loaded cache with ${this.cache.size} entries`);
      }
    } catch (error) {
      console.error('[NodeTranslationCache] Error loading from storage:', error);
    }
  }

  // Save cache to localStorage
  private saveToStorage(): void {
    try {
      const data: Record<string, any> = {};
      this.cache.forEach((entry, key) => {
        data[key] = {
          translations: Object.fromEntries(entry.translations),
          lastUpdated: entry.lastUpdated,
          isComplete: entry.isComplete
        };
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[NodeTranslationCache] Error saving to storage:', error);
    }
  }

  // Get cached translation for a specific node
  getNodeTranslation(userId: string, timeRange: string, language: string, nodeId: string): string | null {
    if (language === 'en') return nodeId;

    const cacheKey = this.getCacheKey(userId, timeRange, language);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return null;

    // Check if cache is expired
    if (Date.now() - entry.lastUpdated > this.CACHE_EXPIRY) {
      console.log(`[NodeTranslationCache] Cache expired for ${cacheKey}`);
      this.cache.delete(cacheKey);
      this.saveToStorage();
      return null;
    }

    const translation = entry.translations.get(nodeId);
    if (translation) {
      console.log(`[NodeTranslationCache] Cache hit for ${nodeId} in ${cacheKey}`);
      return translation.translatedText;
    }

    return null;
  }

  // Set translation for a node
  setNodeTranslation(
    userId: string, 
    timeRange: string, 
    language: string, 
    nodeId: string, 
    translatedText: string,
    source: 'coordinated' | 'app-level' | 'direct' = 'coordinated'
  ): void {
    if (language === 'en') return;

    const cacheKey = this.getCacheKey(userId, timeRange, language);
    let entry = this.cache.get(cacheKey);
    
    if (!entry) {
      entry = {
        translations: new Map(),
        lastUpdated: Date.now(),
        isComplete: false
      };
      this.cache.set(cacheKey, entry);
    }

    entry.translations.set(nodeId, {
      text: nodeId,
      translatedText,
      language,
      timestamp: Date.now(),
      source
    });

    entry.lastUpdated = Date.now();
    this.saveToStorage();

    console.log(`[NodeTranslationCache] Set translation for ${nodeId}: ${translatedText} (source: ${source})`);
  }

  // Pre-populate cache with batch translations
  async prePopulateCache(
    userId: string, 
    timeRange: string, 
    language: string, 
    nodeIds: string[]
  ): Promise<Map<string, string>> {
    if (language === 'en') {
      const result = new Map<string, string>();
      nodeIds.forEach(nodeId => result.set(nodeId, nodeId));
      return result;
    }

    const cacheKey = this.getCacheKey(userId, timeRange, language);
    const translations = new Map<string, string>();

    // Check existing cache first
    const entry = this.cache.get(cacheKey);
    const uncachedNodes: string[] = [];

    nodeIds.forEach(nodeId => {
      const cached = this.getNodeTranslation(userId, timeRange, language, nodeId);
      if (cached) {
        translations.set(nodeId, cached);
      } else {
        uncachedNodes.push(nodeId);
      }
    });

    // Batch translate uncached nodes
    if (uncachedNodes.length > 0) {
      console.log(`[NodeTranslationCache] Batch translating ${uncachedNodes.length} nodes for ${cacheKey}`);
      
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: uncachedNodes,
            sourceLanguage: 'en',
            targetLanguage: language,
            cleanResult: true
          }
        });

        if (!error && data && data.translatedTexts) {
          uncachedNodes.forEach((nodeId, index) => {
            const translatedText = data.translatedTexts[index] || nodeId;
            translations.set(nodeId, translatedText);
            this.setNodeTranslation(userId, timeRange, language, nodeId, translatedText, 'coordinated');
          });

          // Mark cache as complete if all nodes were translated
          const cacheEntry = this.cache.get(cacheKey);
          if (cacheEntry) {
            cacheEntry.isComplete = true;
            this.saveToStorage();
          }

          console.log(`[NodeTranslationCache] Batch translation completed: ${data.translatedTexts.length} translations`);
        } else {
          console.error('[NodeTranslationCache] Batch translation failed:', error);
          // Use original text as fallback
          uncachedNodes.forEach(nodeId => {
            translations.set(nodeId, nodeId);
          });
        }
      } catch (error) {
        console.error('[NodeTranslationCache] Batch translation error:', error);
        // Use original text as fallback
        uncachedNodes.forEach(nodeId => {
          translations.set(nodeId, nodeId);
        });
      }
    }

    return translations;
  }

  // Check if cache is complete for a given context
  isCacheComplete(userId: string, timeRange: string, language: string): boolean {
    if (language === 'en') return true;
    
    const cacheKey = this.getCacheKey(userId, timeRange, language);
    const entry = this.cache.get(cacheKey);
    
    return entry ? entry.isComplete : false;
  }

  // Get all translations for a context
  getAllTranslations(userId: string, timeRange: string, language: string): Map<string, string> {
    const result = new Map<string, string>();
    
    if (language === 'en') return result;

    const cacheKey = this.getCacheKey(userId, timeRange, language);
    const entry = this.cache.get(cacheKey);
    
    if (entry) {
      entry.translations.forEach((translation, nodeId) => {
        result.set(nodeId, translation.translatedText);
      });
    }

    return result;
  }

  // Clear cache for a specific context
  clearCache(userId: string, timeRange?: string, language?: string): void {
    if (timeRange && language) {
      const cacheKey = this.getCacheKey(userId, timeRange, language);
      this.cache.delete(cacheKey);
      console.log(`[NodeTranslationCache] Cleared cache for ${cacheKey}`);
    } else if (language) {
      // Clear all time ranges for this language
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.includes(`-${language}`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`[NodeTranslationCache] Cleared ${keysToDelete.length} entries for language ${language}`);
    } else {
      // Clear all entries for this user
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(`${userId}-`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`[NodeTranslationCache] Cleared ${keysToDelete.length} entries for user ${userId}`);
    }
    
    this.saveToStorage();
  }

  // Get cache statistics
  getCacheStats(): { totalEntries: number; totalTranslations: number; cacheSize: string } {
    let totalTranslations = 0;
    this.cache.forEach(entry => {
      totalTranslations += entry.translations.size;
    });

    const cacheSize = new Blob([localStorage.getItem(this.STORAGE_KEY) || '']).size;
    const cacheSizeKB = (cacheSize / 1024).toFixed(2);

    return {
      totalEntries: this.cache.size,
      totalTranslations,
      cacheSize: `${cacheSizeKB} KB`
    };
  }
}

export const nodeTranslationCache = new NodeTranslationCache();
