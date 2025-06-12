
interface LanguageCacheEntry {
  translations: Map<string, string>;
  lastUpdated: number;
  isComplete: boolean;
  totalNodes: number;
  translatedNodes: number;
}

interface BatchTranslationRequest {
  texts: string[];
  targetLanguage: string;
  sourceLanguage: string;
}

interface BatchTranslationResult {
  translations: Map<string, string>;
  isComplete: boolean;
  progress: number;
}

// APP-LEVEL: Translation service interface for coordination
interface AppLevelTranslationService {
  batchTranslate(options: BatchTranslationRequest): Promise<Map<string, string>>;
}

export class LanguageLevelTranslationCache {
  private static readonly CACHE_KEY_PREFIX = 'lang-level-translations';
  private static readonly CACHE_VERSION = 1;
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  
  private static cache = new Map<string, LanguageCacheEntry>();
  private static activeTranslations = new Map<string, Promise<BatchTranslationResult>>();
  private static appTranslationService: AppLevelTranslationService | null = null;
  
  // APP-LEVEL: Set the translation service for coordination
  static setAppLevelTranslationService(service: AppLevelTranslationService) {
    console.log('[LanguageLevelTranslationCache] APP-LEVEL: Setting translation service');
    this.appTranslationService = service;
  }
  
  // Generate cache key for a language (not time-range specific)
  private static generateLanguageCacheKey(userId: string, language: string): string {
    return `${this.CACHE_KEY_PREFIX}-${userId}-${language}-v${this.CACHE_VERSION}`;
  }
  
  // Get all translations for a language (across all time ranges)
  static getLanguageTranslations(userId: string, language: string): Map<string, string> {
    if (language === 'en') {
      console.log('[LanguageLevelTranslationCache] LANGUAGE-LEVEL: English detected, returning empty map');
      return new Map();
    }
    
    const cacheKey = this.generateLanguageCacheKey(userId, language);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Found ${cached.translations.size} cached translations for ${language}`);
      return new Map(cached.translations);
    }
    
    // Try localStorage
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.isCacheValid(parsed)) {
          const translations = new Map(Object.entries(parsed.translations || {}));
          
          const cacheEntry: LanguageCacheEntry = {
            translations,
            lastUpdated: parsed.lastUpdated,
            isComplete: parsed.isComplete,
            totalNodes: parsed.totalNodes,
            translatedNodes: parsed.translatedNodes
          };
          
          this.cache.set(cacheKey, cacheEntry);
          console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Loaded ${translations.size} translations from localStorage for ${language}`);
          return new Map(translations);
        }
      }
    } catch (error) {
      console.error('[LanguageLevelTranslationCache] Error loading from localStorage:', error);
    }
    
    console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: No cached translations found for ${language}`);
    return new Map();
  }
  
  // Batch translate and cache at language level
  static async ensureLanguageTranslations(
    userId: string, 
    language: string, 
    allNodeTexts: string[]
  ): Promise<BatchTranslationResult> {
    if (language === 'en') {
      const englishTranslations = new Map<string, string>();
      allNodeTexts.forEach(text => englishTranslations.set(text, text));
      
      return {
        translations: englishTranslations,
        isComplete: true,
        progress: 100
      };
    }
    
    const cacheKey = this.generateLanguageCacheKey(userId, language);
    
    // Check if translation is already in progress
    const activeTranslation = this.activeTranslations.get(cacheKey);
    if (activeTranslation) {
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Waiting for active translation for ${language}`);
      return await activeTranslation;
    }
    
    // Get existing translations
    const existingTranslations = this.getLanguageTranslations(userId, language);
    
    // Find missing translations
    const missingTexts = allNodeTexts.filter(text => !existingTranslations.has(text));
    
    if (missingTexts.length === 0) {
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: All ${allNodeTexts.length} texts already translated for ${language}`);
      return {
        translations: existingTranslations,
        isComplete: true,
        progress: 100
      };
    }
    
    console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Need to translate ${missingTexts.length} missing texts for ${language}`);
    
    // Start translation process
    const translationPromise = this.performBatchTranslation(userId, language, missingTexts, existingTranslations);
    this.activeTranslations.set(cacheKey, translationPromise);
    
    try {
      const result = await translationPromise;
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Completed batch translation for ${language}`);
      return result;
    } finally {
      this.activeTranslations.delete(cacheKey);
    }
  }
  
  // Perform the actual batch translation
  private static async performBatchTranslation(
    userId: string,
    language: string,
    missingTexts: string[],
    existingTranslations: Map<string, string>
  ): Promise<BatchTranslationResult> {
    const cacheKey = this.generateLanguageCacheKey(userId, language);
    
    try {
      if (!this.appTranslationService) {
        console.warn('[LanguageLevelTranslationCache] LANGUAGE-LEVEL: No translation service available, using fallback');
        
        // Fallback: use original texts
        const fallbackTranslations = new Map(existingTranslations);
        missingTexts.forEach(text => fallbackTranslations.set(text, text));
        
        this.setCacheEntry(cacheKey, {
          translations: fallbackTranslations,
          lastUpdated: Date.now(),
          isComplete: true,
          totalNodes: fallbackTranslations.size,
          translatedNodes: fallbackTranslations.size
        });
        
        return {
          translations: fallbackTranslations,
          isComplete: true,
          progress: 100
        };
      }
      
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Translating ${missingTexts.length} texts from 'en' to '${language}'`);
      
      const batchResults = await this.appTranslationService.batchTranslate({
        texts: missingTexts,
        targetLanguage: language,
        sourceLanguage: 'en'
      });
      
      // Combine existing and new translations
      const allTranslations = new Map(existingTranslations);
      
      batchResults.forEach((translatedText, originalText) => {
        if (translatedText && translatedText.trim() !== '') {
          allTranslations.set(originalText, translatedText);
          console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: ✓ "${originalText}" -> "${translatedText}"`);
        } else {
          console.warn(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: ⚠ Empty translation for "${originalText}", using original`);
          allTranslations.set(originalText, originalText);
        }
      });
      
      // Ensure all missing texts have translations
      missingTexts.forEach(text => {
        if (!allTranslations.has(text)) {
          console.warn(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: ⚠ No translation found for "${text}", using original`);
          allTranslations.set(text, text);
        }
      });
      
      // Cache the complete language translations
      this.setCacheEntry(cacheKey, {
        translations: allTranslations,
        lastUpdated: Date.now(),
        isComplete: true,
        totalNodes: allTranslations.size,
        translatedNodes: allTranslations.size
      });
      
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Successfully cached ${allTranslations.size} translations for ${language}`);
      
      return {
        translations: allTranslations,
        isComplete: true,
        progress: 100
      };
      
    } catch (error) {
      console.error('[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Error during batch translation:', error);
      
      // Fallback on error
      const fallbackTranslations = new Map(existingTranslations);
      missingTexts.forEach(text => fallbackTranslations.set(text, text));
      
      this.setCacheEntry(cacheKey, {
        translations: fallbackTranslations,
        lastUpdated: Date.now(),
        isComplete: true,
        totalNodes: fallbackTranslations.size,
        translatedNodes: fallbackTranslations.size
      });
      
      return {
        translations: fallbackTranslations,
        isComplete: true,
        progress: 100
      };
    }
  }
  
  // Check if a language has complete translations
  static hasCompleteTranslations(userId: string, language: string): boolean {
    if (language === 'en') return true;
    
    const cacheKey = this.generateLanguageCacheKey(userId, language);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached.isComplete;
    }
    
    return false;
  }
  
  // Clear cache for a specific language
  static clearLanguageCache(userId: string, language?: string): void {
    if (language) {
      const cacheKey = this.generateLanguageCacheKey(userId, language);
      this.cache.delete(cacheKey);
      localStorage.removeItem(cacheKey);
      this.activeTranslations.delete(cacheKey);
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Cleared cache for ${language}`);
    } else {
      // Clear all languages for user
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(`-${userId}-`) && key.startsWith(this.CACHE_KEY_PREFIX)
      );
      
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        localStorage.removeItem(key);
      });
      
      // Clear active translations
      const activeKeysToDelete = Array.from(this.activeTranslations.keys()).filter(key => 
        key.includes(`-${userId}-`) && key.startsWith(this.CACHE_KEY_PREFIX)
      );
      
      activeKeysToDelete.forEach(key => {
        this.activeTranslations.delete(key);
      });
      
      console.log(`[LanguageLevelTranslationCache] LANGUAGE-LEVEL: Cleared all language caches for user ${userId}`);
    }
  }
  
  private static isCacheValid(cached: LanguageCacheEntry): boolean {
    return (Date.now() - cached.lastUpdated) < this.CACHE_DURATION;
  }
  
  private static setCacheEntry(cacheKey: string, entry: LanguageCacheEntry): void {
    this.cache.set(cacheKey, entry);
    
    try {
      const storableEntry = {
        ...entry,
        translations: Object.fromEntries(entry.translations)
      };
      localStorage.setItem(cacheKey, JSON.stringify(storableEntry));
    } catch (error) {
      console.error('[LanguageLevelTranslationCache] Error saving to localStorage:', error);
    }
  }
  
  // Get translation progress for UI
  static getTranslationProgress(userId: string, language: string): { progress: number; isComplete: boolean } {
    if (language === 'en') {
      return { progress: 100, isComplete: true };
    }
    
    const cacheKey = this.generateLanguageCacheKey(userId, language);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      const progress = cached.totalNodes > 0 ? Math.round((cached.translatedNodes / cached.totalNodes) * 100) : 100;
      return { progress, isComplete: cached.isComplete };
    }
    
    return { progress: 0, isComplete: false };
  }
}
