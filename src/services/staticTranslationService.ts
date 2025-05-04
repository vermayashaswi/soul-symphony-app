
import { TranslationService } from './translationService';
import { useTranslation } from '@/contexts/TranslationContext';
import { translationCache } from './translationCache';

// Create a static service for batch translation operations
// that can be used outside React components (without hooks)
class StaticTranslationService {
  private translationInProgress = new Map<string, Promise<string>>();
  private batchTranslationInProgress = false;
  private currentLanguage: string = 'en';

  // Set current language
  setLanguage(lang: string) {
    this.currentLanguage = lang;
    console.log(`StaticTranslationService: language set to ${lang}`);
  }

  // Translate a single text
  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    try {
      if (!text || text.trim().length === 0 || this.currentLanguage === 'en') {
        return text;
      }

      // Check cache first
      const cacheKey = `${this.currentLanguage}:${text.substring(0, 100)}`;
      const cachedEntry = await translationCache.getTranslation(text, this.currentLanguage);
      
      if (cachedEntry) {
        console.log(`Using cached translation for: ${text.substring(0, 20)}...`);
        return cachedEntry.translatedText;
      }

      // If not in cache, translate it
      console.log(`Translating text to ${this.currentLanguage}: "${text.substring(0, 30)}..."`);
      
      // Use the translation service
      const translated = await TranslationService.translateText({
        text,
        sourceLanguage: sourceLanguage || 'en',
        targetLanguage: this.currentLanguage,
        entryId
      });

      // Clean up any language code that might have been appended
      const cleanTranslation = translated.replace(/\s*[\(\[]([a-z]{2})[\)\]]\s*$/i, '');
      
      // Cache the translation for future use
      await translationCache.setTranslation({
        originalText: text,
        translatedText: cleanTranslation,
        language: this.currentLanguage,
        timestamp: Date.now(),
        version: 1
      });

      return cleanTranslation;
    } catch (error) {
      console.error('Static translation service error:', error);
      return text; // Return original text on error
    }
  }

  // Batch translate multiple texts
  async batchTranslateTexts(texts: string[]): Promise<Map<string, string>> {
    try {
      if (!texts || texts.length === 0 || this.currentLanguage === 'en') {
        const results = new Map<string, string>();
        texts?.forEach(text => results.set(text, text));
        return results;
      }
      
      console.log(`Batch translating ${texts.length} texts to ${this.currentLanguage}`);
      
      // Use the translation service's batch method
      return await TranslationService.batchTranslate({
        texts,
        targetLanguage: this.currentLanguage
      });
    } catch (error) {
      console.error('Batch translation error:', error);
      
      // Return original texts on error
      const fallbackMap = new Map<string, string>();
      texts.forEach(text => fallbackMap.set(text, text));
      return fallbackMap;
    }
  }

  // Pre-translate a batch of texts efficiently
  async preTranslate(texts: string[]): Promise<Map<string, string>> {
    try {
      if (!texts || texts.length === 0) {
        console.log('No texts to translate');
        return new Map();
      }

      // Get current language from localStorage as this service operates outside React
      const currentLang = this.currentLanguage || localStorage.getItem('i18nextLng')?.split('-')[0] || 'en';
      
      // Skip translation if language is English
      if (currentLang === 'en') {
        console.log('Language is English, no translation needed');
        const results = new Map<string, string>();
        texts.forEach(text => results.set(text, text));
        return results;
      }

      console.log(`Pre-translating ${texts.length} texts to ${currentLang}`);
      
      // Filter out empty or very short texts
      const validTexts = texts.filter(text => text && text.trim().length > 1);

      // First check cache for all texts
      const results = new Map<string, string>();
      const textsToTranslate: string[] = [];

      // Try to get cached translations first
      for (const text of validTexts) {
        const cacheKey = `${currentLang}:${text.substring(0, 100)}`;
        const cachedEntry = await translationCache.getTranslation(text, currentLang);
        
        if (cachedEntry) {
          results.set(text, cachedEntry.translatedText);
          console.log(`Using cached translation for: ${text.substring(0, 20)}...`);
        } else {
          textsToTranslate.push(text);
        }
      }

      // If all texts were in cache, return immediately
      if (textsToTranslate.length === 0) {
        console.log(`All ${texts.length} texts were found in cache`);
        return results;
      }

      // Set flag to avoid multiple simultaneous batch translations
      if (this.batchTranslationInProgress) {
        console.log('Another batch translation is in progress, waiting...');
        // Wait a bit and check if another operation is still running
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (this.batchTranslationInProgress) {
          console.log('Still waiting for another translation to finish...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      this.batchTranslationInProgress = true;
      
      try {
        // Implement retry logic with backoff
        const MAX_RETRIES = 3;
        let retries = 0;
        let batchResults: Map<string, string> = new Map();
        
        while (retries < MAX_RETRIES) {
          try {
            console.log(`Batch translating ${textsToTranslate.length} texts (attempt ${retries + 1}/${MAX_RETRIES})`);
            batchResults = await TranslationService.batchTranslate({
              texts: textsToTranslate,
              targetLanguage: currentLang
            });
            
            // If successful, break out of retry loop
            break;
          } catch (error) {
            retries++;
            console.error(`Batch translation failed (attempt ${retries}/${MAX_RETRIES}):`, error);
            if (retries >= MAX_RETRIES) {
              throw error; // Re-throw if max retries reached
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
          }
        }
        
        // Combine cache results with new translations
        batchResults.forEach((translation, originalText) => {
          results.set(originalText, translation);
          
          // Clean up any language code that might have been appended
          const cleanTranslation = translation.replace(/\s*[\(\[]([a-z]{2})[\)\]]\s*$/i, '');
          
          // Cache the new translations
          translationCache.setTranslation({
            originalText,
            translatedText: cleanTranslation,
            language: currentLang,
            timestamp: Date.now(),
            version: 1
          });
        });
        
        console.log(`Successfully translated ${batchResults.size} texts`);
        
        // For any texts that failed to translate, use the original
        textsToTranslate.forEach(text => {
          if (!results.has(text)) {
            console.warn(`Translation failed for text: ${text.substring(0, 20)}...`);
            results.set(text, text); // Fallback to original
          }
        });
      } finally {
        this.batchTranslationInProgress = false;
      }

      return results;
    } catch (error) {
      console.error('Static translation service error:', error);
      
      // In case of error, return original texts
      const fallbackResults = new Map<string, string>();
      texts.forEach(text => fallbackResults.set(text, text));
      this.batchTranslationInProgress = false;
      
      return fallbackResults;
    }
  }
  
  // Method to check if translations are complete and valid
  verifyTranslations(originalTexts: string[], translations: Map<string, string>): boolean {
    // Count how many originals have translations
    let translatedCount = 0;
    
    for (const text of originalTexts) {
      if (translations.has(text) && translations.get(text) !== text) {
        translatedCount++;
      }
    }
    
    // Consider translations complete if at least 80% were translated
    const completionRate = originalTexts.length > 0 ? 
      (translatedCount / originalTexts.length) : 0;
      
    console.log(`Translation verification: ${translatedCount}/${originalTexts.length} (${Math.round(completionRate * 100)}%)`);
    
    return completionRate >= 0.8;
  }
}

export const staticTranslationService = new StaticTranslationService();
