
import { TranslationService } from './translationService';

export class StaticTranslationService {
  private language: string = 'en';

  setLanguage(language: string): void {
    this.language = language;
  }

  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    // Skip translation for English or empty text
    if (this.language === 'en' || !text || text.trim() === '') {
      return text;
    }

    try {
      const result = await TranslationService.translateText({
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
    
    // Filter out empty texts
    const validTexts = texts.filter(text => text && text.trim() !== '');
    
    if (validTexts.length === 0) {
      return new Map<string, string>();
    }

    try {
      console.log(`StaticTranslationService: Batch translating ${validTexts.length} texts to ${this.language}`);
      return await TranslationService.batchTranslate({
        texts: validTexts,
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

  // Enhanced method to support batch translation with better error handling and logging
  async batchTranslateTexts(texts: string[]): Promise<Map<string, string>> {
    if (this.language === 'en') {
      // For English, just return originals
      const results = new Map<string, string>();
      texts.forEach(text => results.set(text, text));
      return results;
    }

    // Filter out empty texts
    const validTexts = texts.filter(text => text && text.trim() !== '');
    
    // If no valid texts, return empty map
    if (validTexts.length === 0) {
      return new Map<string, string>();
    }
    
    try {
      console.log(`StaticTranslationService: Batch translating ${validTexts.length} texts to ${this.language}`);
      
      const translationResults = await TranslationService.batchTranslate({
        texts: validTexts,
        targetLanguage: this.language,
      });
      
      console.log(`StaticTranslationService: Translation complete, got ${translationResults.size} results`);
      
      // Debug log the individual translations
      validTexts.forEach(text => {
        console.log(`Translation for "${text.substring(0, 30)}...": "${translationResults.get(text)?.substring(0, 30) || 'not found'}..."`);
      });
      
      return translationResults;
    } catch (error) {
      console.error('Error batch translating texts:', error);
      // Return original texts as fallback
      const results = new Map<string, string>();
      texts.forEach(text => results.set(text, text));
      return results;
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
