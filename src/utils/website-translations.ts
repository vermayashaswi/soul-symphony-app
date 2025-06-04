
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

// Singleton for caching on-demand translations
class TranslationCache {
  private cache = new Map<string, Map<string, string>>();
  private storageKey = 'soulo-translation-cache';
  
  constructor() {
    this.loadFromLocalStorage();
    console.log('[TranslationCache] GOOGLE TRANSLATE ONLY - Initialized cache with size:', this.getCacheSize());
  }

  // Load cached translations from localStorage
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
        console.log(`[TranslationCache] Loaded ${this.getCacheSize()} translations from local storage`);
      }
    } catch (error) {
      console.error('[TranslationCache] Error loading from localStorage:', error);
    }
  }

  // Save current cache to localStorage
  private saveToLocalStorage(): void {
    try {
      const cacheObject: Record<string, Record<string, string>> = {};
      this.cache.forEach((translations, language) => {
        cacheObject[language] = Object.fromEntries(translations);
      });
      localStorage.setItem(this.storageKey, JSON.stringify(cacheObject));
    } catch (error) {
      console.error('[TranslationCache] Error saving to localStorage:', error);
    }
  }
  
  get(language: string, text: string): string | null {
    if (!text || language === 'en') return text;
    
    const languageCache = this.cache.get(language);
    if (languageCache && languageCache.has(text)) {
      console.log(`[TranslationCache] Cache hit for ${language}:"${text.substring(0, 20)}..."`);
      return languageCache.get(text) || null;
    }
    console.log(`[TranslationCache] Cache miss for ${language}:"${text.substring(0, 20)}..."`);
    return null;
  }
  
  set(language: string, text: string, translatedText: string): void {
    if (language === 'en' || !text || !translatedText || text === translatedText) {
      return;
    }
    
    console.log(`[TranslationCache] Caching translation for ${language}:"${text.substring(0, 20)}..."`)
    
    let languageCache = this.cache.get(language);
    if (!languageCache) {
      languageCache = new Map<string, string>();
      this.cache.set(language, languageCache);
    }
    
    languageCache.set(text, translatedText);
    this.saveToLocalStorage();
  }
  
  // Clear all translations for a specific language
  clearLanguage(language: string): void {
    console.log(`[TranslationCache] Clearing cache for language: ${language}`);
    this.cache.delete(language);
    this.saveToLocalStorage();
  }
  
  // Clear all translations
  clearAll(): void {
    console.log(`[TranslationCache] Clearing entire cache`);
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
}

export const onDemandTranslationCache = new TranslationCache();
