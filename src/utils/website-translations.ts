// This utility helps preload common website translations using Google Translate only
export const preloadWebsiteTranslations = async (language: string) => {
  if (language === 'en') return; // Skip for English
  
  console.log(`GOOGLE TRANSLATE ONLY - Preloading website translations for ${language}`);
  
  // Note: Preloading is handled by the translation context with Google Translate
  // This is kept for backward compatibility but doesn't perform actual preloading
  return new Map();
};

export const translateWebsiteText = async (text: string): Promise<string> => {
  if (!text) return '';
  
  try {
    // This function is deprecated - use the translation context instead
    console.log(`translateWebsiteText is deprecated - use translation context with Google Translate`);
    return text;
  } catch (error) {
    console.error(`Failed to translate website text: "${text}"`, error);
    return text;
  }
};

// Enhanced singleton for caching multi-language translations
class EnhancedTranslationCache {
  private cache = new Map<string, Map<string, string>>();
  private storageKey = 'soulo-translation-cache-v2';
  private maxCacheSize = 10000; // Increased for multi-language support
  
  constructor() {
    this.loadFromLocalStorage();
    console.log('[EnhancedTranslationCache] MULTI-LANGUAGE SUPPORT - Initialized cache with size:', this.getCacheSize());
  }

  // Load cached translations from localStorage with migration support
  private loadFromLocalStorage(): void {
    try {
      const storedCache = localStorage.getItem(this.storageKey);
      if (storedCache) {
        const parsedCache = JSON.parse(storedCache);
        Object.entries(parsedCache).forEach(([language, translations]: [string, any]) => {
          const langMap = new Map<string, string>();
          Object.entries(translations).forEach(([key, value]: [string, any]) => {
            langMap.set(key, value as string);
          });
          this.cache.set(language, langMap);
        });
        console.log(`[EnhancedTranslationCache] Loaded ${this.getCacheSize()} translations from local storage`);
      }
      
      // Clean up old cache format
      const oldCache = localStorage.getItem('soulo-translation-cache');
      if (oldCache) {
        console.log('[EnhancedTranslationCache] Migrating old cache format');
        localStorage.removeItem('soulo-translation-cache');
      }
    } catch (error) {
      console.error('[EnhancedTranslationCache] Error loading from localStorage:', error);
      this.clearAll(); // Clear corrupted cache
    }
  }

  // Save current cache to localStorage with size management
  private saveToLocalStorage(): void {
    try {
      // Check cache size and clean if necessary
      if (this.getCacheSize() > this.maxCacheSize) {
        this.cleanupCache();
      }
      
      const cacheObject: Record<string, Record<string, string>> = {};
      this.cache.forEach((translations, language) => {
        cacheObject[language] = Object.fromEntries(translations);
      });
      localStorage.setItem(this.storageKey, JSON.stringify(cacheObject));
      console.log(`[EnhancedTranslationCache] Saved ${this.getCacheSize()} translations to localStorage`);
    } catch (error) {
      console.error('[EnhancedTranslationCache] Error saving to localStorage:', error);
      if (error.name === 'QuotaExceededError') {
        console.log('[EnhancedTranslationCache] Storage quota exceeded, clearing cache');
        this.clearAll();
      }
    }
  }

  // Clean up old cache entries to manage size
  private cleanupCache(): void {
    console.log('[EnhancedTranslationCache] Cleaning up cache due to size limit');
    
    // Keep only the most recently used languages (last 5)
    const languagesBySize = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => b.size - a.size)
      .slice(0, 5);
    
    this.cache.clear();
    languagesBySize.forEach(([language, translations]) => {
      this.cache.set(language, translations);
    });
  }
  
  get(language: string, text: string): string | null {
    if (!text || language === 'en') return text;
    
    const languageCache = this.cache.get(language);
    if (languageCache && languageCache.has(text)) {
      console.log(`[EnhancedTranslationCache] Cache hit for ${language}:"${text.substring(0, 20)}..."`);
      return languageCache.get(text) || null;
    }
    console.log(`[EnhancedTranslationCache] Cache miss for ${language}:"${text.substring(0, 20)}..."`);
    return null;
  }
  
  set(language: string, text: string, translatedText: string): void {
    if (language === 'en' || !text || !translatedText || text === translatedText) {
      return;
    }
    
    console.log(`[EnhancedTranslationCache] Caching translation for ${language}:"${text.substring(0, 20)}..." -> "${translatedText.substring(0, 20)}..."`)
    
    let languageCache = this.cache.get(language);
    if (!languageCache) {
      languageCache = new Map<string, string>();
      this.cache.set(language, languageCache);
    }
    
    languageCache.set(text, translatedText);
    
    // Save to localStorage periodically
    if (languageCache.size % 10 === 0) {
      this.saveToLocalStorage();
    }
  }
  
  // Clear all translations for a specific language
  clearLanguage(language: string): void {
    console.log(`[EnhancedTranslationCache] Clearing cache for language: ${language}`);
    this.cache.delete(language);
    this.saveToLocalStorage();
  }
  
  // Clear all translations
  clearAll(): void {
    console.log(`[EnhancedTranslationCache] Clearing entire cache`);
    this.cache.clear();
    localStorage.removeItem(this.storageKey);
  }
  
  // Get total number of cached translations
  getCacheSize(): number {
    let total = 0;
    this.cache.forEach(langMap => {
      total += langMap.size;
    });
    return total;
  }
  
  // Debug method to get all translations for a language
  getAllForLanguage(language: string): Record<string, string> {
    const languageCache = this.cache.get(language);
    if (languageCache) {
      return Object.fromEntries(languageCache);
    }
    return {};
  }

  // Get cache statistics
  getStats(): { languages: number, totalTranslations: number, languageBreakdown: Record<string, number> } {
    const languageBreakdown: Record<string, number> = {};
    this.cache.forEach((translations, language) => {
      languageBreakdown[language] = translations.size;
    });
    
    return {
      languages: this.cache.size,
      totalTranslations: this.getCacheSize(),
      languageBreakdown
    };
  }
}

export const onDemandTranslationCache = new EnhancedTranslationCache();
