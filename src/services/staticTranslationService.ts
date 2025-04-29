
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
    // Use "en" as the default source language
    const effectiveSourceLang = sourceLanguage || "en";
    
    // Skip translation if target language is English or same as source
    if (this.targetLanguage === 'en' || 
        this.targetLanguage === effectiveSourceLang) {
      return text;
    }
    
    try {
      console.log(`Translating text: "${text.substring(0, 30)}..." to ${this.targetLanguage} from ${effectiveSourceLang} for entry: ${entryId || 'unknown'}`);
      const result = await TranslationService.translateText({
        text,
        sourceLanguage: effectiveSourceLang,
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
