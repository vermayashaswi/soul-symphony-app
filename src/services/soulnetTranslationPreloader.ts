import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface SoulNetTranslationData {
  nodeTranslations: Map<string, string>;
  loadedAt: number;
  userId: string;
  timeRange: string;
  language: string;
}

// ENHANCED: Comprehensive text validation utilities
function isValidNodeText(text: string): boolean {
  if (typeof text !== 'string') {
    console.warn(`[SoulNetTranslationPreloader] Non-string text:`, typeof text, text);
    return false;
  }
  
  const trimmed = text.trim();
  
  // Check for empty or whitespace-only strings
  if (trimmed.length === 0) {
    console.warn(`[SoulNetTranslationPreloader] Empty text after trim:`, text);
    return false;
  }
  
  // Check for invalid placeholder values
  const invalidValues = ['undefined', 'null', 'NaN', '[object Object]', 'true', 'false'];
  if (invalidValues.includes(trimmed.toLowerCase())) {
    console.warn(`[SoulNetTranslationPreloader] Invalid text value:`, trimmed);
    return false;
  }
  
  // Check for numeric-only strings (often invalid)
  if (/^\d+$/.test(trimmed)) {
    console.warn(`[SoulNetTranslationPreloader] Numeric-only text:`, trimmed);
    return false;
  }
  
  // Check minimum meaningful length
  if (trimmed.length < 2) {
    console.warn(`[SoulNetTranslationPreloader] Text too short:`, trimmed);
    return false;
  }
  
  console.log(`[SoulNetTranslationPreloader] Valid text:`, trimmed);
  return true;
}

function filterValidNodeTexts(nodeTexts: string[]): string[] {
  console.log(`[SoulNetTranslationPreloader] Validating ${nodeTexts.length} node texts`);
  
  const validTexts = nodeTexts.filter(text => {
    const isValid = isValidNodeText(text);
    if (!isValid) {
      console.warn(`[SoulNetTranslationPreloader] Filtering out invalid text:`, text);
    }
    return isValid;
  });
  
  console.log(`[SoulNetTranslationPreloader] Validation complete: ${validTexts.length}/${nodeTexts.length} texts are valid`);
  return validTexts;
}

export class SoulNetTranslationPreloader {
  private static readonly CACHE_KEY = 'soulnet-translations';
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private static cache = new Map<string, SoulNetTranslationData>();
  private static readonly MAX_RETRIES = 3;

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
    
    return this.performTranslationWithRetry(cacheKey, userId, timeRange, language, nodeTexts);
  }

  private static async performTranslationWithRetry(
    cacheKey: string,
    userId: string,
    timeRange: string,
    language: string,
    nodeTexts?: string[],
    retryCount: number = 0
  ): Promise<SoulNetTranslationData | null> {
    try {
      const nodeTranslations = new Map<string, string>();
      
      if (nodeTexts && nodeTexts.length > 0) {
        // ENHANCED: Filter valid texts before translation with detailed logging
        console.log(`[SoulNetTranslationPreloader] Original texts:`, nodeTexts);
        const validNodeTexts = filterValidNodeTexts(nodeTexts);
        
        if (validNodeTexts.length === 0) {
          console.warn(`[SoulNetTranslationPreloader] No valid node texts to translate after filtering`);
          const emptyData: SoulNetTranslationData = {
            nodeTranslations: new Map(),
            loadedAt: Date.now(),
            userId,
            timeRange,
            language
          };
          return emptyData;
        }

        console.log(`[SoulNetTranslationPreloader] Batch translating ${validNodeTexts.length} valid node texts to ${language}`);
        console.log(`[SoulNetTranslationPreloader] Valid texts to translate:`, validNodeTexts);
        
        // Batch translate all valid node texts
        const batchResults = await translationService.batchTranslate({
          texts: validNodeTexts,
          targetLanguage: language
        });
        
        console.log(`[SoulNetTranslationPreloader] Batch translation completed, processing ${batchResults.size} results`);
        
        batchResults.forEach((translatedText, originalText) => {
          if (translatedText && isValidNodeText(translatedText) && translatedText !== originalText) {
            nodeTranslations.set(originalText, translatedText);
            // Also cache in on-demand cache
            onDemandTranslationCache.set(language, originalText, translatedText);
            console.log(`[SoulNetTranslationPreloader] Translation stored: "${originalText}" -> "${translatedText}"`);
          } else {
            console.warn(`[SoulNetTranslationPreloader] Invalid or unchanged translation for "${originalText}":`, translatedText);
          }
        });

        console.log(`[SoulNetTranslationPreloader] Successfully processed ${nodeTranslations.size} translations`);
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
      
      console.log(`[SoulNetTranslationPreloader] Preloaded ${nodeTranslations.size} translations for ${cacheKey}`);
      return translationData;
    } catch (error) {
      console.error(`[SoulNetTranslationPreloader] Error preloading translations (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < this.MAX_RETRIES) {
        console.log(`[SoulNetTranslationPreloader] Retrying translation (${retryCount + 1}/${this.MAX_RETRIES})`);
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.performTranslationWithRetry(cacheKey, userId, timeRange, language, nodeTexts, retryCount + 1);
      }
      
      console.error(`[SoulNetTranslationPreloader] Max retries exceeded, returning null`);
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

    // ENHANCED: Validate text before lookup with detailed logging
    if (!isValidNodeText(text)) {
      console.warn(`[SoulNetTranslationPreloader] Invalid text for sync lookup: "${text}"`);
      return text; // Return original for invalid texts
    }

    const cacheKey = `${userId}-${timeRange}-${language}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.nodeTranslations.has(text)) {
      const translation = cached.nodeTranslations.get(text);
      if (translation && isValidNodeText(translation)) {
        console.log(`[SoulNetTranslationPreloader] Cache hit: "${text}" -> "${translation}"`);
        return translation;
      } else {
        console.warn(`[SoulNetTranslationPreloader] Invalid cached translation for "${text}":`, translation);
      }
    }

    // Check on-demand cache as fallback
    const onDemandResult = onDemandTranslationCache.get(language, text);
    if (onDemandResult && isValidNodeText(onDemandResult)) {
      console.log(`[SoulNetTranslationPreloader] On-demand cache hit: "${text}" -> "${onDemandResult}"`);
      return onDemandResult;
    }

    console.log(`[SoulNetTranslationPreloader] No translation found for "${text}" in ${language}`);
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
