
// Add or update the translateText method to accept sourceLanguage
import { translationCache } from './translationCache';

class StaticTranslationService {
  private currentLanguage = 'en';

  setLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    // If target is English or text is empty, return as is
    if (targetLanguage === 'en' || !text) {
      return text;
    }

    try {
      // Check cache first (consider source language in cache key if provided)
      const cacheKey = sourceLanguage 
        ? `${sourceLanguage}:${targetLanguage}:${text}` 
        : `${targetLanguage}:${text}`;
      
      const cachedTranslation = await translationCache.getTranslation(cacheKey, targetLanguage);
      if (cachedTranslation) {
        console.log(`[Translation] Cache hit for ${text.substring(0, 20)}...`);
        return cachedTranslation.translatedText;
      }

      console.log(`[Translation] Translating "${text.substring(0, 20)}..." to ${targetLanguage}`);
      
      // Here you would call your actual translation service
      // For this example, we're using a mock that converts text based on language
      // In a real app, you'd call a translation API
      // Pass sourceLanguage to your translation service if available
      const translatedText = await this.mockTranslate(text, targetLanguage, sourceLanguage);
      
      // Cache the result
      await translationCache.setTranslation({
        originalText: cacheKey,
        translatedText: translatedText,
        language: targetLanguage,
        timestamp: Date.now(),
        version: 1
      });
      
      return translatedText;
    } catch (error) {
      console.error('[Translation] Error translating text:', error);
      return text; // Return original text on error
    }
  }

  // Mock translation for demo purposes
  private async mockTranslate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    // In a real app, this would be replaced with a call to a translation service API
    console.log(`[Translation] Mock translating from ${sourceLang || 'auto'} to ${targetLang}: ${text.substring(0, 20)}...`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simple mock translation by adding language indicator
    // In a real implementation, this would be the actual translation
    return `[${targetLang}] ${text}`;
  }
}

export const staticTranslationService = new StaticTranslationService();
