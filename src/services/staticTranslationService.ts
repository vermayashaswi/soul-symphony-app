
import { supabase } from '@/integrations/supabase/client';
import { translationCache } from './translationCache';

class StaticTranslationService {
  private currentLanguage: string = 'en';
  private translationPromises: Map<string, Promise<string>> = new Map();

  setLanguage(language: string) {
    if (this.currentLanguage !== language) {
      this.currentLanguage = language;
      // Clear pending promises when language changes
      this.translationPromises.clear();
    }
  }

  private createCacheKey(text: string, targetLanguage: string): string {
    return `${targetLanguage}:${text.substring(0, 100)}`;
  }

  async translateText(text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string> {
    if (!text || text.trim() === '') {
      return text;
    }

    if (this.currentLanguage === 'en') {
      return text;
    }

    const cacheKey = this.createCacheKey(text, this.currentLanguage);
    
    // Check if we already have a translation in progress for this text
    if (this.translationPromises.has(cacheKey)) {
      return this.translationPromises.get(cacheKey)!;
    }

    // Check cache first
    try {
      const cached = await translationCache.getTranslation(text, this.currentLanguage);
      if (cached) {
        return cached.translatedText;
      }
    } catch (error) {
      console.error('StaticTranslationService: Cache check failed:', error);
    }

    // Create translation promise
    const translationPromise = this.performTranslation(text, sourceLanguage, entryId);
    this.translationPromises.set(cacheKey, translationPromise);

    try {
      const result = await translationPromise;
      return result;
    } catch (error) {
      console.error(`StaticTranslationService: Translation failed for "${text.substring(0, 30)}..."`, error);
      return text; // Fallback to original
    } finally {
      // Clean up the promise
      this.translationPromises.delete(cacheKey);
    }
  }

  private async performTranslation(text: string, sourceLanguage: string, entryId?: number): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: text,
          sourceLanguage: sourceLanguage,
          targetLanguage: this.currentLanguage,
          entryId: entryId,
          cleanResult: true
        },
      });

      if (error) {
        console.error('StaticTranslationService: Supabase function error:', error);
        throw error;
      }

      if (!data || !data.translatedText) {
        console.error('StaticTranslationService: Invalid response format:', data);
        throw new Error('Invalid translation response format');
      }

      // Cache the result
      try {
        await translationCache.setTranslation({
          originalText: text,
          translatedText: data.translatedText,
          language: this.currentLanguage,
          timestamp: Date.now(),
          version: 1,
        });
      } catch (cacheError) {
        console.error('StaticTranslationService: Failed to cache translation:', cacheError);
      }

      return data.translatedText;
    } catch (error) {
      console.error('StaticTranslationService: Translation request failed:', error);
      throw error;
    }
  }

  async batchTranslateTexts(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (this.currentLanguage === 'en') {
      texts.forEach(text => results.set(text, text));
      return results;
    }

    // Process texts individually to maintain proper error handling and caching
    const promises = texts.map(async (text) => {
      try {
        const translated = await this.translateText(text);
        results.set(text, translated);
      } catch (error) {
        console.error(`StaticTranslationService: Batch translation failed for "${text.substring(0, 30)}..."`, error);
        results.set(text, text); // Fallback to original
      }
    });

    await Promise.all(promises);
    return results;
  }

  async preTranslate(texts: string[]): Promise<Map<string, string>> {
    return this.batchTranslateTexts(texts);
  }

  // Method to test edge function connectivity
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: 'test',
          sourceLanguage: 'en',
          targetLanguage: 'hi',
          cleanResult: true
        },
      });

      if (error) {
        console.error('StaticTranslationService: Connection test failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('StaticTranslationService: Connection test error:', error);
      return false;
    }
  }

  // Method to clear all translation caches
  async clearAllCaches(): Promise<void> {
    try {
      // Clear memory cache
      this.translationPromises.clear();
      
      // Clear IndexedDB cache for current language
      await translationCache.clearCache(this.currentLanguage);
    } catch (error) {
      console.error('StaticTranslationService: Failed to clear caches:', error);
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
