
import { TranslationService } from './translationService';

class StaticTranslationService {
  private targetLanguage: string = 'en';
  private translationCache = new Map<string, {text: string, timestamp: number}>();
  private cacheLifetime = 1000 * 60 * 30; // 30 minutes

  /**
   * Set the target language for translations
   */
  setLanguage(lang: string) {
    if (this.targetLanguage !== lang) {
      console.log(`StaticTranslationService: Changing language from ${this.targetLanguage} to ${lang}`);
      // Clear cache when language changes
      this.translationCache.clear();
    }
    this.targetLanguage = lang;
  }

  /**
   * Get the current target language
   */
  getLanguage(): string {
    return this.targetLanguage;
  }

  /**
   * Translate text to the current target language
   * @param text The text to translate
   * @param sourceLanguage Optional source language of the text
   * @param entryId Optional entry ID for caching purposes
   * @returns The translated text
   */
  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    // Use "en" as the default source language
    const effectiveSourceLang = sourceLanguage || "en";
    
    // Skip translation if target language is English or same as source
    if (this.targetLanguage === 'en' || 
        this.targetLanguage === effectiveSourceLang || 
        !text || 
        text.trim() === '') {
      return text;
    }

    // Create a cache key that includes the language
    const cacheKey = `${this.targetLanguage}:${text}`;
    
    // Check cache first
    const cachedItem = this.translationCache.get(cacheKey);
    if (cachedItem && (Date.now() - cachedItem.timestamp) < this.cacheLifetime) {
      console.log(`Translation cache hit for: "${text.substring(0, 30)}..."`);
      return cachedItem.text;
    }
    
    try {
      console.log(`Translating text: "${text.substring(0, 30)}..." to ${this.targetLanguage} from ${effectiveSourceLang}${entryId ? ` for entry: ${entryId}` : ''}`);
      const result = await TranslationService.translateText({
        text,
        sourceLanguage: effectiveSourceLang,
        targetLanguage: this.targetLanguage,
        entryId
      });
      
      // Cache the result
      if (result) {
        this.translationCache.set(cacheKey, {
          text: result,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      console.error('Static translation error:', error);
      // Store original text in cache to prevent repeated failed attempts
      this.translationCache.set(cacheKey, {
        text,
        timestamp: Date.now() - (this.cacheLifetime / 2) // Cache for half the lifetime
      });
      return text;
    }
  }

  /**
   * Clear the translation cache
   */
  clearCache(): void {
    console.log('Clearing translation cache');
    this.translationCache.clear();
  }

  /**
   * Pre-translate an array of texts
   */
  async preTranslate(texts: string[], sourceLanguage: string = "en"): Promise<Map<string, string>> {
    if (this.targetLanguage === 'en' || texts.length === 0) {
      // No need to translate
      return new Map(texts.map(text => [text, text]));
    }
    
    console.log(`Pre-translating ${texts.length} items to ${this.targetLanguage}`);
    
    try {
      const translationsMap = await TranslationService.batchTranslate({
        texts,
        targetLanguage: this.targetLanguage
      });
      
      return translationsMap;
    } catch (error) {
      console.error('Error pre-translating texts:', error);
      return new Map(texts.map(text => [text, text]));
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
