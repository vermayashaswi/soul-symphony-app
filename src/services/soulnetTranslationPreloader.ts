
import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface SoulNetTranslationData {
  nodeTranslations: Map<string, string>;
  loadedAt: number;
  userId: string;
  timeRange: string;
  language: string;
}

export class SoulNetTranslationPreloader {
  private static readonly CACHE_KEY = 'soulnet-translations';
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private static cache = new Map<string, SoulNetTranslationData>();

  static async preloadSoulNetTranslations(
    userId: string,
    timeRange: string,
    language: string,
    nodeTexts?: string[]
  ): Promise<SoulNetTranslationData | null> {
    if (language === 'en') {
      // For English, create a pass-through translation map
      const englishData: SoulNetTranslationData = {
        nodeTranslations: new Map(),
        loadedAt: Date.now(),
        userId,
        timeRange,
        language: 'en'
      };
      return englishData;
    }

    const cacheKey = `${userId}-${timeRange}-${language}`;
    
    // Check cache first
    const cached = this.getCachedTranslations(cacheKey);
    if (cached) {
      console.log(`[SoulNetTranslationPreloader] Using cached translations for ${cacheKey}`);
      return cached;
    }

    console.log(`[SoulNetTranslationPreloader] Preloading translations for ${language}`);
    
    try {
      const nodeTranslations = new Map<string, string>();
      
      if (nodeTexts && nodeTexts.length > 0) {
        // Batch translate all node texts
        const batchResults = await translationService.batchTranslate({
          texts: nodeTexts,
          targetLanguage: language
        });
        
        batchResults.forEach((translatedText, originalText) => {
          if (translatedText && translatedText !== originalText) {
            nodeTranslations.set(originalText, translatedText);
            // Also cache in on-demand cache
            onDemandTranslationCache.set(language, originalText, translatedText);
          }
        });
      }

      const translationData: SoulNetTranslationData = {
        nodeTranslations,
        loadedAt: Date.now(),
        userId,
        timeRange,
        language
      };

      // Cache the results
      this.setCachedTranslations(cacheKey, translationData);
      
      console.log(`[SoulNetTranslationPreloader] Preloaded ${nodeTranslations.size} translations`);
      return translationData;
    } catch (error) {
      console.error('[SoulNetTranslationPreloader] Error preloading translations:', error);
      return null;
    }
  }

  static getTranslationSync(
    text: string,
    language: string,
    userId: string,
    timeRange: string
  ): string | null {
    if (language === 'en') {
      return text;
    }

    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.nodeTranslations.has(text)) {
      return cached.nodeTranslations.get(text) || null;
    }

    // Check on-demand cache as fallback
    const onDemandResult = onDemandTranslationCache.get(language, text);
    if (onDemandResult) {
      return onDemandResult;
    }

    return null;
  }

  private static getCachedTranslations(cacheKey: string): SoulNetTranslationData | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.loadedAt) < this.CACHE_DURATION) {
      return cached;
    }
    
    // Try localStorage
    try {
      const stored = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if ((Date.now() - parsed.loadedAt) < this.CACHE_DURATION) {
          // Convert object back to Map
          parsed.nodeTranslations = new Map(Object.entries(parsed.nodeTranslations || {}));
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[SoulNetTranslationPreloader] Error loading from localStorage:', error);
    }
    
    return null;
  }

  private static setCachedTranslations(cacheKey: string, data: SoulNetTranslationData): void {
    this.cache.set(cacheKey, data);
    
    // Store in localStorage
    try {
      const storableData = {
        ...data,
        nodeTranslations: Object.fromEntries(data.nodeTranslations)
      };
      localStorage.setItem(`${this.CACHE_KEY}-${cacheKey}`, JSON.stringify(storableData));
    } catch (error) {
      console.error('[SoulNetTranslationPreloader] Error saving to localStorage:', error);
    }
  }

  static clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(`${this.CACHE_KEY}-${key}`);
      });
    } else {
      this.cache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  }
}
