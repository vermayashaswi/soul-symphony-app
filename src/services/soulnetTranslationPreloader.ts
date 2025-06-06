
import { translationService } from '@/services/translationService';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';

interface PreloadedSoulNetTranslations {
  nodeTranslations: Map<string, string>;
  uiTranslations: Map<string, string>;
  timestamp: number;
  language: string;
  userId: string;
  timeRange: string;
}

export class SoulNetTranslationPreloader {
  private static readonly CACHE_KEY = 'soulnet-translations-cache';
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private static cache = new Map<string, PreloadedSoulNetTranslations>();

  static async preloadSoulNetTranslations(
    userId: string,
    timeRange: string,
    targetLanguage: string
  ): Promise<PreloadedSoulNetTranslations | null> {
    console.log(`[SoulNetTranslationPreloader] Preloading translations for ${targetLanguage}`);
    
    if (targetLanguage === 'en') {
      return {
        nodeTranslations: new Map(),
        uiTranslations: new Map(),
        timestamp: Date.now(),
        language: targetLanguage,
        userId,
        timeRange
      };
    }

    const cacheKey = `${userId}-${timeRange}-${targetLanguage}`;
    const cached = this.getCachedTranslations(cacheKey);
    
    if (cached) {
      console.log(`[SoulNetTranslationPreloader] Using cached translations for ${cacheKey}`);
      return cached;
    }

    try {
      // Get the SoulNet data first
      const soulNetData = await SoulNetPreloadService.preloadSoulNetData(userId, timeRange, 'en');
      
      if (!soulNetData || soulNetData.nodes.length === 0) {
        console.log(`[SoulNetTranslationPreloader] No SoulNet data available`);
        return null;
      }

      // Extract all unique node names for translation
      const nodeNames = Array.from(new Set(soulNetData.nodes.map(node => node.id)));
      
      // Preload UI translations
      const uiTexts = [
        'Soul-Net Visualization',
        'Error Loading Soul-Net',
        'Retry',
        '3D Visualization Unavailable',
        'The 3D visualization is experiencing technical difficulties. Your data is safe and you can try again.',
        'Try Again',
        'Reload Page',
        'Drag to rotate • Pinch to zoom • Tap a node to highlight connections',
        'Drag to rotate • Scroll to zoom • Click a node to highlight connections',
        'Visualization Error',
        'The 3D visualization encountered an error.'
      ];

      console.log(`[SoulNetTranslationPreloader] Batch translating ${nodeNames.length} nodes and ${uiTexts.length} UI texts`);

      // Batch translate node names
      const nodeTranslationsResult = await translationService.batchTranslate({
        texts: nodeNames,
        targetLanguage
      });

      // Batch translate UI texts
      const uiTranslationsResult = await translationService.batchTranslate({
        texts: uiTexts,
        targetLanguage
      });

      const preloadedData: PreloadedSoulNetTranslations = {
        nodeTranslations: nodeTranslationsResult,
        uiTranslations: uiTranslationsResult,
        timestamp: Date.now(),
        language: targetLanguage,
        userId,
        timeRange
      };

      // Cache the results
      this.setCachedTranslations(cacheKey, preloadedData);
      
      console.log(`[SoulNetTranslationPreloader] Successfully preloaded ${nodeTranslationsResult.size} node translations and ${uiTranslationsResult.size} UI translations`);
      return preloadedData;
    } catch (error) {
      console.error(`[SoulNetTranslationPreloader] Error preloading translations:`, error);
      return null;
    }
  }

  static getTranslationSync(text: string, language: string, userId: string, timeRange: string): string | null {
    if (language === 'en') return text;
    
    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.nodeTranslations.get(text) || cached.uiTranslations.get(text) || null;
    }
    
    return null;
  }

  private static getCachedTranslations(cacheKey: string): PreloadedSoulNetTranslations | null {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached;
    }
    
    // Try localStorage as fallback
    try {
      const storedData = localStorage.getItem(`${this.CACHE_KEY}-${cacheKey}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if ((Date.now() - parsed.timestamp) < this.CACHE_DURATION) {
          // Convert Maps back from objects
          parsed.nodeTranslations = new Map(Object.entries(parsed.nodeTranslations || {}));
          parsed.uiTranslations = new Map(Object.entries(parsed.uiTranslations || {}));
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[SoulNetTranslationPreloader] Error loading from localStorage:', error);
    }
    
    return null;
  }

  private static setCachedTranslations(cacheKey: string, data: PreloadedSoulNetTranslations): void {
    this.cache.set(cacheKey, data);
    
    // Also store in localStorage
    try {
      const storableData = {
        ...data,
        nodeTranslations: Object.fromEntries(data.nodeTranslations),
        uiTranslations: Object.fromEntries(data.uiTranslations)
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
