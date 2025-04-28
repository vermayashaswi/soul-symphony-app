
import { supabase } from '@/integrations/supabase/client';
import { translationCache } from './translationCache';
import { toast } from 'sonner';

type TranslationResult = {
  original: string;
  translated: string;
};

class StaticTranslationService {
  private static readonly BATCH_SIZE = 20;
  private currentLanguage = 'en';
  private translationsInProgress = new Map<string, Promise<string>>();
  
  setLanguage(lang: string) {
    console.log(`StaticTranslationService: Setting language to ${lang}`);
    this.currentLanguage = lang;
  }
  
  getLanguage(): string {
    return this.currentLanguage;
  }
  
  async translateText(text: string, targetLanguage: string = this.currentLanguage): Promise<string> {
    // If target language is English or text is empty, return the original text
    if (targetLanguage === 'en' || !text?.trim()) {
      return text;
    }
    
    console.log(`StaticTranslationService: Translating to ${targetLanguage}`);
    
    // Check if there's already a translation in progress for this text
    const inProgressKey = `${text}_${targetLanguage}`;
    if (this.translationsInProgress.has(inProgressKey)) {
      return this.translationsInProgress.get(inProgressKey) as Promise<string>;
    }
    
    // Check cache first
    try {
      const cached = await translationCache.getTranslation(text, targetLanguage);
      if (cached) {
        console.log('Using cached translation');
        return cached.translatedText;
      }
    } catch (error) {
      console.error('Cache error:', error);
      // Continue with API call if cache fails
    }
    
    // For testing when Supabase edge function is not available
    // Just return a simple mock translation
    if (!text) return '';
    
    // Fall back to simple mock translation if needed
    try {
      // Create a new translation promise
      const translationPromise = this.fetchTranslation(text, targetLanguage);
      this.translationsInProgress.set(inProgressKey, translationPromise);
      
      const result = await translationPromise;
      // Remove from in-progress map once done
      this.translationsInProgress.delete(inProgressKey);
      return result;
    } catch (error) {
      console.error('Translation failed:', error);
      this.translationsInProgress.delete(inProgressKey);
      
      // Mock translation for testing/fallback
      if (targetLanguage === 'es') {
        return `ES: ${text}`;
      } else if (targetLanguage === 'fr') {
        return `FR: ${text}`;
      } else if (targetLanguage === 'de') {
        return `DE: ${text}`;
      } else if (targetLanguage === 'zh') {
        return `ZH: ${text}`;
      }
      
      return text; // Default fallback to original text
    }
  }
  
  private async fetchTranslation(text: string, targetLanguage: string): Promise<string> {
    try {
      // Call the edge function for translation
      const { data, error } = await supabase.functions.invoke('translate-static-content', {
        body: {
          texts: [text],
          targetLanguage,
        },
      });

      if (error) {
        console.error('Translation error:', error);
        return text; // Fallback to original text
      }

      if (!data || !data.translations || !data.translations[0]) {
        console.error('Invalid translation response format');
        return text;
      }

      const translatedText = data.translations[0].translated;

      // Cache the successful translation
      try {
        await translationCache.setTranslation({
          originalText: text,
          translatedText,
          language: targetLanguage,
          timestamp: Date.now(),
          version: 1,
        });
      } catch (cacheError) {
        console.error('Cache write error:', cacheError);
      }

      return translatedText;
    } catch (error) {
      console.error('Translation service error:', error);
      return text; // Fallback to original text
    }
  }
  
  async batchTranslate(texts: string[], targetLanguage: string = this.currentLanguage): Promise<Map<string, string>> {
    if (targetLanguage === 'en' || texts.length === 0) {
      // No translation needed for English or empty list
      return new Map(texts.map(text => [text, text]));
    }
    
    const results = new Map<string, string>();
    const needsTranslation: string[] = [];
    
    // Check cache first for all texts
    for (const text of texts) {
      try {
        const cached = await translationCache.getTranslation(text, targetLanguage);
        if (cached) {
          results.set(text, cached.translatedText);
        } else {
          needsTranslation.push(text);
        }
      } catch (error) {
        needsTranslation.push(text);
      }
    }
    
    if (needsTranslation.length === 0) {
      return results;
    }
    
    // Process in batches
    try {
      const { data, error } = await supabase.functions.invoke('translate-static-content', {
        body: {
          texts: needsTranslation,
          targetLanguage,
          sourceLanguage: 'en',
        },
      });

      if (error) {
        console.error('Batch translation error:', error);
        // Fallback to original text for untranslated items
        needsTranslation.forEach(text => results.set(text, text));
        return results;
      }
      
      // Process and cache all translations
      const translations: TranslationResult[] = data.translations;
      for (const item of translations) {
        results.set(item.original, item.translated);
        
        // Cache each translation
        try {
          await translationCache.setTranslation({
            originalText: item.original,
            translatedText: item.translated,
            language: targetLanguage,
            timestamp: Date.now(),
            version: 1,
          });
        } catch (cacheError) {
          console.error('Cache write error:', cacheError);
        }
      }
    } catch (error) {
      console.error('Batch translation service error:', error);
      // Fallback to original text for untranslated items
      needsTranslation.forEach(text => results.set(text, text));
    }
    
    return results;
  }
}

export const staticTranslationService = new StaticTranslationService();
