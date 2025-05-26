
// Translation cache class with required methods
class OnDemandTranslationCache {
  private cache = new Map<string, string>();

  private getCacheKey(text: string, language: string): string {
    return `${text}:${language}`;
  }

  getTranslation(text: string, language: string): string | null {
    const key = this.getCacheKey(text, language);
    return this.cache.get(key) || null;
  }

  setTranslation(text: string, translation: string, language: string): void {
    const key = this.getCacheKey(text, language);
    this.cache.set(key, translation);
  }

  clearLanguage(language: string): void {
    // Remove all entries for a specific language
    const keysToDelete: string[] = [];
    for (const [key] of this.cache) {
      if (key.endsWith(`:${language}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }
}

// Simple website translations utility
export const getWebsiteTranslation = (key: string, language: string = 'en'): string => {
  // For now, just return the key as we're using Google Translate API
  // This can be expanded later if needed for specific website translations
  return key;
};

// Export the translation cache instance
export const onDemandTranslationCache = new OnDemandTranslationCache();

export const websiteTranslations = {
  get: getWebsiteTranslation
};
