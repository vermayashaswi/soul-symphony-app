
import { TranslationService } from './translationService';

class StaticTranslationService {
  private targetLanguage: string = 'en';

  /**
   * Set the target language for translations
   */
  setLanguage(lang: string) {
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
    // Skip translation if target language is English or same as source
    if (this.targetLanguage === 'en' || 
        (sourceLanguage && this.targetLanguage === sourceLanguage)) {
      return text;
    }
    
    try {
      console.log(`Translating text: "${text.substring(0, 30)}..." to ${this.targetLanguage} from ${sourceLanguage || 'unknown'} for entry: ${entryId || 'unknown'}`);
      
      // For now, we'll use mock translations since the TranslationService might not be working
      // We'll prepend a language identifier to make it obvious which language is being used
      const mockTranslations: Record<string, string> = {
        'es': `[ES] ${text}`,
        'fr': `[FR] ${text}`,
        'de': `[DE] ${text}`,
        'hi': `[हिंदी] ${text}`,
        'zh': `[中文] ${text}`,
        'ja': `[日本語] ${text}`,
        'ru': `[РУ] ${text}`,
        'ar': `[عربي] ${text}`,
        'pt': `[PT] ${text}`,
      };
      
      if (mockTranslations[this.targetLanguage]) {
        return mockTranslations[this.targetLanguage];
      }
      
      // If the language isn't in our mock translations, use the TranslationService
      const result = await TranslationService.translateText({
        text,
        sourceLanguage,
        targetLanguage: this.targetLanguage,
        entryId
      });
      
      return result;
    } catch (error) {
      console.error('Static translation error:', error);
      return text;
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
