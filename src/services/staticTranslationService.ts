
import { supabase } from '@/integrations/supabase/client';

class StaticTranslationService {
  private currentLanguage: string = 'en';
  private cache = new Map<string, Map<string, string>>();

  setLanguage(language: string): void {
    this.currentLanguage = language;
    console.log(`StaticTranslationService: Language set to ${language}`);
  }

  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    if (!text || text.trim() === '') return text;
    if (this.currentLanguage === 'en') return text;

    // Check cache first
    const cacheKey = this.createCacheKey(text, this.currentLanguage);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`StaticTranslationService: Using cached translation for "${text.substring(0, 30)}..."`);
        return cached.get(text) || text;
      }
    }

    try {
      console.log(`StaticTranslationService: Translating "${text.substring(0, 30)}..." to ${this.currentLanguage}`);
      
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: text,
          sourceLanguage: sourceLanguage || 'en',
          targetLanguage: this.currentLanguage,
          entryId: entryId,
          cleanResult: true
        },
      });

      if (error) {
        console.error('StaticTranslationService: Translation error:', error);
        return text;
      }

      if (!data || !data.translatedText) {
        console.error('StaticTranslationService: No translated text in response:', data);
        return text;
      }

      // Cache the result
      this.cacheTranslation(text, data.translatedText, this.currentLanguage);
      
      console.log(`StaticTranslationService: Translation successful for "${text.substring(0, 30)}...": "${data.translatedText.substring(0, 30)}..."`);
      return data.translatedText;
    } catch (error) {
      console.error('StaticTranslationService: Translation service error:', error);
      return text;
    }
  }

  async batchTranslateTexts(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (!texts.length || this.currentLanguage === 'en') {
      texts.forEach(text => results.set(text, text));
      return results;
    }

    const filteredTexts = texts.filter(text => text && text.trim() !== '');
    
    try {
      console.log(`StaticTranslationService: Batch translating ${filteredTexts.length} texts to ${this.currentLanguage}`);
      
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          texts: filteredTexts,
          targetLanguage: this.currentLanguage,
          cleanResult: true
        },
      });

      if (error) {
        console.error('StaticTranslationService: Batch translation error:', error);
        filteredTexts.forEach(text => results.set(text, text));
        return results;
      }

      if (data && data.translatedTexts && Array.isArray(data.translatedTexts)) {
        filteredTexts.forEach((text, index) => {
          const translatedText = data.translatedTexts[index] || text;
          results.set(text, translatedText);
          this.cacheTranslation(text, translatedText, this.currentLanguage);
        });
      } else {
        console.error('StaticTranslationService: Invalid batch translation response:', data);
        filteredTexts.forEach(text => results.set(text, text));
      }
    } catch (error) {
      console.error('StaticTranslationService: Batch translation service error:', error);
      filteredTexts.forEach(text => results.set(text, text));
    }

    console.log(`StaticTranslationService: Batch translation completed, ${results.size} results`);
    return results;
  }

  async preTranslate(texts: string[]): Promise<Map<string, string>> {
    return this.batchTranslateTexts(texts);
  }

  private createCacheKey(text: string, language: string): string {
    return `${language}:${text.substring(0, 50)}`;
  }

  private cacheTranslation(originalText: string, translatedText: string, language: string): void {
    const cacheKey = this.createCacheKey(originalText, language);
    
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, new Map());
    }
    
    const languageCache = this.cache.get(cacheKey)!;
    languageCache.set(originalText, translatedText);
  }

  clearCache(): void {
    this.cache.clear();
    console.log('StaticTranslationService: Cache cleared');
  }
}

export const staticTranslationService = new StaticTranslationService();
