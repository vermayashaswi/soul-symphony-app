
import { TranslationService } from './translationService';

class StaticTranslationService {
  private targetLanguage: string = 'en';
  private translationCache = new Map<string, {text: string, timestamp: number}>();
  private cacheLifetime = 1000 * 60 * 30; // 30 minutes
  private translationPromises = new Map<string, Promise<string>>();

  /**
   * Set the target language for translations
   */
  setLanguage(lang: string) {
    if (this.targetLanguage !== lang) {
      console.log(`StaticTranslationService: Changing language from ${this.targetLanguage} to ${lang}`);
      // Clear cache when language changes
      this.translationCache.clear();
      this.translationPromises.clear();
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
    
    // Skip translation if target language is English or same as source or text is empty
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
    
    // Check if we're already translating this text
    if (this.translationPromises.has(cacheKey)) {
      console.log(`Reusing in-progress translation for: "${text.substring(0, 30)}..."`);
      try {
        return await this.translationPromises.get(cacheKey)!;
      } catch (error) {
        console.error('Error in reused translation promise:', error);
        // Continue to new translation attempt if the shared promise failed
      }
    }
    
    // Create a new translation promise
    const translationPromise = this.performTranslation(text, effectiveSourceLang, entryId, cacheKey);
    this.translationPromises.set(cacheKey, translationPromise);
    
    try {
      const result = await translationPromise;
      return result;
    } finally {
      // Remove the promise when done (whether successful or failed)
      this.translationPromises.delete(cacheKey);
    }
  }
  
  /**
   * Perform the actual translation and cache the result
   */
  private async performTranslation(
    text: string, 
    sourceLanguage: string, 
    entryId?: number,
    cacheKey?: string
  ): Promise<string> {
    const effectiveCacheKey = cacheKey || `${this.targetLanguage}:${text}`;
    
    try {
      console.log(`Translating text: "${text.substring(0, 30)}..." to ${this.targetLanguage} from ${sourceLanguage}${entryId ? ` for entry: ${entryId}` : ''}`);
      
      // Add retries for reliability
      let retries = 0;
      const maxRetries = 2;
      let result = '';
      
      while (retries <= maxRetries) {
        try {
          result = await TranslationService.translateText({
            text,
            sourceLanguage,
            targetLanguage: this.targetLanguage,
            entryId
          });
          
          if (result) break; // Success, exit retry loop
          
          retries++;
          if (retries <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * retries)); // Backoff
          }
        } catch (retryError) {
          console.warn(`Translation retry ${retries}/${maxRetries} failed:`, retryError);
          retries++;
          if (retries <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * retries)); // Backoff
          } else {
            throw retryError; // Rethrow the last error after all retries fail
          }
        }
      }
      
      // Cache the result if we got one
      if (result) {
        this.translationCache.set(effectiveCacheKey, {
          text: result,
          timestamp: Date.now()
        });
        return result;
      } else {
        throw new Error('Empty translation result after retries');
      }
    } catch (error) {
      console.error('Static translation error:', error);
      // Store original text in cache to prevent repeated failed attempts
      this.translationCache.set(effectiveCacheKey, {
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
    this.translationPromises.clear();
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
      // First check cache for all texts
      const result = new Map<string, string>();
      const uncachedTexts: string[] = [];
      
      for (const text of texts) {
        const cacheKey = `${this.targetLanguage}:${text}`;
        const cachedItem = this.translationCache.get(cacheKey);
        
        if (cachedItem && (Date.now() - cachedItem.timestamp) < this.cacheLifetime) {
          result.set(text, cachedItem.text);
        } else {
          uncachedTexts.push(text);
        }
      }
      
      // If we have uncached texts, get them translated
      if (uncachedTexts.length > 0) {
        // Add retry logic for batch translations
        let retries = 0;
        const maxRetries = 2;
        let batchTranslations: Map<string, string> | null = null;
        
        while (retries <= maxRetries && !batchTranslations) {
          try {
            batchTranslations = await TranslationService.batchTranslate({
              texts: uncachedTexts,
              targetLanguage: this.targetLanguage
            });
            
            // Cache the translations
            if (batchTranslations) {
              for (const [original, translated] of batchTranslations.entries()) {
                const cacheKey = `${this.targetLanguage}:${original}`;
                this.translationCache.set(cacheKey, {
                  text: translated,
                  timestamp: Date.now()
                });
                result.set(original, translated);
              }
            }
          } catch (error) {
            console.error(`Batch translation retry ${retries}/${maxRetries} failed:`, error);
            retries++;
            
            if (retries <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500 * retries)); // Backoff
            } else {
              // If all retries fail, use original texts
              for (const text of uncachedTexts) {
                result.set(text, text);
                // Cache the original to prevent repeated failures
                const cacheKey = `${this.targetLanguage}:${text}`;
                this.translationCache.set(cacheKey, {
                  text,
                  timestamp: Date.now() - (this.cacheLifetime / 2) // Cache for half the lifetime
                });
              }
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error pre-translating texts:', error);
      return new Map(texts.map(text => [text, text]));
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
