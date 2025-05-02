import { TranslationService } from './translationService';

export class StaticTranslationService {
  private language: string = 'en';
  private translationService: TranslationService;

  constructor() {
    this.translationService = new TranslationService();
  }

  setLanguage(language: string): void {
    this.language = language;
  }

  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    // Skip translation for English or empty text
    if (this.language === 'en' || !text || text.trim() === '') {
      return text;
    }

    try {
      const result = await this.translationService.translateText({
        text,
        sourceLanguage,
        targetLanguage: this.language,
        entryId,
      });

      return result;
    } catch (error) {
      console.error('Error translating text:', error);
      return text;
    }
  }

  async preTranslate(texts: string[]): Promise<Map<string, string>> {
    if (this.language === 'en') {
      // For English, just return originals
      const results = new Map<string, string>();
      texts.forEach(text => results.set(text, text));
      return results;
    }

    try {
      return await this.translationService.batchTranslate({
        texts,
        targetLanguage: this.language,
      });
    } catch (error) {
      console.error('Error batch translating texts:', error);
      // Return original texts as fallback
      const results = new Map<string, string>();
      texts.forEach(text => results.set(text, text));
      return results;
    }
  }

  // New method to support batch translation with explicit source language
  async batchTranslateTexts(texts: string[], sourceLanguage = 'en'): Promise<Map<string, string>> {
    if (this.language === 'en') {
      // For English, just return originals
      const results = new Map<string, string>();
      texts.forEach(text => results.set(text, text));
      return results;
    }

    try {
      // Filter out empty texts
      const validTexts = texts.filter(text => text && text.trim() !== '');
      
      // If no valid texts, return empty map
      if (validTexts.length === 0) {
        return new Map<string, string>();
      }
      
      const translationResults = await this.translationService.batchTranslate({
        texts: validTexts,
        targetLanguage: this.language,
      });
      
      return translationResults;
    } catch (error) {
      console.error('Error batch translating texts with source language:', error);
      // Return original texts as fallback
      const results = new Map<string, string>();
      texts.forEach(text => results.set(text, text));
      return results;
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
