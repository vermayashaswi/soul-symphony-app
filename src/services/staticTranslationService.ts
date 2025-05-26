
import { supabase } from '@/integrations/supabase/client';
import { translationCache } from './translationCache';

class StaticTranslationService {
  private currentLanguage: string = 'en';
  private translationPromises: Map<string, Promise<string>> = new Map();
  private debugMode: boolean = true;

  setLanguage(language: string) {
    if (this.currentLanguage !== language) {
      console.log(`StaticTranslationService: Language changed from ${this.currentLanguage} to ${language}`);
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
      if (this.debugMode) console.log('StaticTranslationService: Empty text provided');
      return text;
    }

    if (this.currentLanguage === 'en') {
      if (this.debugMode) console.log('StaticTranslationService: Current language is English, returning original text');
      return text;
    }

    const cacheKey = this.createCacheKey(text, this.currentLanguage);
    
    // Check if we already have a translation in progress for this text
    if (this.translationPromises.has(cacheKey)) {
      if (this.debugMode) console.log(`StaticTranslationService: Translation in progress for "${text.substring(0, 30)}...", waiting for result`);
      return this.translationPromises.get(cacheKey)!;
    }

    // Check cache first
    try {
      const cached = await translationCache.getTranslation(text, this.currentLanguage);
      if (cached) {
        if (this.debugMode) console.log(`StaticTranslationService: Cache hit for "${text.substring(0, 30)}...": "${cached.translatedText.substring(0, 30)}..."`);
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
      if (this.debugMode) console.log(`StaticTranslationService: Translation completed for "${text.substring(0, 30)}...": "${result.substring(0, 30)}..."`);
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
    console.log(`StaticTranslationService: Performing translation for "${text.substring(0, 30)}..." from ${sourceLanguage} to ${this.currentLanguage}`);
    
    try {
      console.log('StaticTranslationService: Calling Supabase translate-text function...');
      
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

      console.log('StaticTranslationService: Raw response from translate-text:', data);

      if (!data) {
        console.error('StaticTranslationService: Empty response from function');
        throw new Error('Empty translation response');
      }

      if (!data.translatedText) {
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
        if (this.debugMode) console.log(`StaticTranslationService: Cached translation for "${text.substring(0, 30)}..."`);
      } catch (cacheError) {
        console.error('StaticTranslationService: Failed to cache translation:', cacheError);
      }

      return data.translatedText;
    } catch (error) {
      console.error('StaticTranslationService: Translation request failed:', error);
      
      // Enhanced error reporting
      if (error && typeof error === 'object') {
        console.error('StaticTranslationService: Error details:', {
          message: (error as any).message,
          name: (error as any).name,
          stack: (error as any).stack
        });
      }
      
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
    console.log(`StaticTranslationService: Pre-translating ${texts.length} texts to ${this.currentLanguage}`);
    return this.batchTranslateTexts(texts);
  }

  // Method to test edge function connectivity
  async testConnection(): Promise<boolean> {
    try {
      console.log('StaticTranslationService: Testing connection to translate-text function...');
      
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

      console.log('StaticTranslationService: Connection test successful:', data);
      return true;
    } catch (error) {
      console.error('StaticTranslationService: Connection test error:', error);
      return false;
    }
  }

  // Method to clear all translation caches
  async clearAllCaches(): Promise<void> {
    try {
      console.log('StaticTranslationService: Clearing all translation caches...');
      
      // Clear memory cache
      this.translationPromises.clear();
      
      // Clear IndexedDB cache for current language
      await translationCache.clearCache(this.currentLanguage);
      
      console.log('StaticTranslationService: All caches cleared successfully');
    } catch (error) {
      console.error('StaticTranslationService: Failed to clear caches:', error);
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
