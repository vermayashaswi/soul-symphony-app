
import { translationCache } from './translationCache';
import { supabase } from '@/integrations/supabase/client';

class StaticTranslationService {
  private language = 'en';
  private translationQueue: Map<string, Promise<string>> = new Map();
  
  // Static translations for common UI text elements - fallback only
  private staticTranslations: Record<string, Record<string, string>> = {
    'en': {}, // No translations needed for English
    'es': {
      'Back to Home': 'Volver al inicio',
      'Privacy Policy': 'Política de Privacidad',
      'Last Updated': 'Última actualización',
      'Read More': 'Leer más',
      'Back to Blog': 'Volver al Blog',
      'More Articles': 'Más artículos'
    },
    'fr': {
      'Back to Home': 'Retour à l\'accueil',
      'Privacy Policy': 'Politique de confidentialité', 
      'Last Updated': 'Dernière mise à jour',
      'Read More': 'Lire plus',
      'Back to Blog': 'Retour au blog',
      'More Articles': 'Plus d\'articles'
    }
  };

  setLanguage(lang: string) {
    console.log(`StaticTranslationService: Setting language to ${lang}`);
    this.language = lang;
  }

  async translateText(text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string> {
    // If already in English or empty text, return as is
    if (this.language === 'en' || !text || text.trim() === '') {
      return text;
    }
    
    // Check for static translations first as fallback
    if (this.staticTranslations[this.language]?.[text]) {
      return this.staticTranslations[this.language][text];
    }

    // Generate a unique key for this translation request
    const cacheKey = `${text}_${this.language}`;
    
    try {
      // Check the cache first
      const cached = await translationCache.getTranslation(text, this.language);
      if (cached?.translatedText) {
        console.log(`StaticTranslationService: Cache hit for "${text.substring(0, 20)}..."`);
        return cached.translatedText;
      }
      
      // If we're already translating this text, return the in-flight promise
      if (this.translationQueue.has(cacheKey)) {
        console.log(`StaticTranslationService: Reusing in-flight request for "${text.substring(0, 20)}..."`);
        return this.translationQueue.get(cacheKey)!;
      }
      
      // Create a new translation promise
      const translationPromise = this.fetchTranslation(text, sourceLanguage, entryId);
      
      // Store the promise in the queue
      this.translationQueue.set(cacheKey, translationPromise);
      
      // When the promise resolves, remove it from the queue
      translationPromise.finally(() => {
        this.translationQueue.delete(cacheKey);
      });
      
      return translationPromise;
    } catch (error) {
      console.error('StaticTranslationService error:', error);
      return text; // Fallback to original
    }
  }
  
  async preTranslate(texts: string[], sourceLanguage: string = 'en'): Promise<Map<string, string>> {
    if (this.language === 'en' || !texts || texts.length === 0) {
      // If target language is English or no texts to translate, return original texts
      const resultMap = new Map<string, string>();
      texts.forEach(text => resultMap.set(text, text));
      return resultMap;
    }
    
    console.log(`StaticTranslationService: Batch translating ${texts.length} items to ${this.language}`);
    
    try {
      // Call the batch translation API
      const { data, error } = await supabase.functions.invoke('translate-static-content', {
        body: {
          texts: texts,
          targetLanguage: this.language,
          sourceLanguage: sourceLanguage
        }
      });
      
      if (error) {
        console.error('Batch translation error:', error);
        throw error;
      }
      
      // Create a map of original text to translated text
      const translationMap = new Map<string, string>();
      
      if (data && data.translations) {
        data.translations.forEach((item: { original: string, translated: string }) => {
          translationMap.set(item.original, item.translated);
          
          // Also store in cache
          translationCache.setTranslation({
            originalText: item.original,
            translatedText: item.translated,
            language: this.language,
            timestamp: Date.now(),
            version: 1,
          });
        });
      }
      
      // For any texts that weren't translated, add the original
      texts.forEach(text => {
        if (!translationMap.has(text)) {
          translationMap.set(text, text);
        }
      });
      
      return translationMap;
    } catch (error) {
      console.error('Batch translation error:', error);
      
      // On error, return original texts
      const fallbackMap = new Map<string, string>();
      texts.forEach(text => fallbackMap.set(text, text));
      return fallbackMap;
    }
  }
  
  private async fetchTranslation(text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string> {
    console.log(`StaticTranslationService: Translating to ${this.language}: "${text.substring(0, 30)}..."`);
    
    try {
      // Call the Supabase function to translate the text
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          sourceLanguage,
          targetLanguage: this.language,
          entryId
        }
      });
      
      if (error) {
        console.error('Translation API error:', error);
        return text; // Fallback to original
      }
      
      if (data && data.translatedText) {
        const translatedText = data.translatedText;
        
        // Store in cache
        await translationCache.setTranslation({
          originalText: text,
          translatedText,
          language: this.language,
          timestamp: Date.now(),
          version: 1,
        });
        
        return translatedText;
      }
      
      return text; // Fallback to original if no translation
    } catch (error) {
      console.error('Translation fetch error:', error);
      return text; // Fallback to original
    }
  }
}

export const staticTranslationService = new StaticTranslationService();
