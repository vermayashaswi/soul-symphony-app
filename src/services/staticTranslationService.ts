
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
   * @param entryId Optional entry ID for context
   * @returns The translated text
   */
  async translateText(text: string, targetLanguage?: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    // Skip translation if target language is English or same as source
    if ((targetLanguage || this.targetLanguage) === 'en' || 
        (sourceLanguage && (targetLanguage || this.targetLanguage) === sourceLanguage)) {
      return text;
    }
    
    try {
      const result = await TranslationService.translateText({
        text,
        sourceLanguage,
        targetLanguage: targetLanguage || this.targetLanguage,
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
