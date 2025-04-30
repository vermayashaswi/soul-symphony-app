
// Create a new service that doesn't depend on the database
// This is used for demo purposes only

import { translationCache } from './translationCache';
import { toast } from 'sonner';

// A basic static translation service that uses mock translations
class StaticTranslationService {
  private language: string = 'en';
  private mockTranslationDelay: number = 200; // 200ms delay to simulate API call
  private pendingTranslations: Map<string, Promise<string>> = new Map();
  
  // Change the language
  setLanguage(lang: string): void {
    if (this.language !== lang) {
      console.log(`StaticTranslationService: Changing language to ${lang}`);
      this.language = lang;
      // Clear pending translations when language changes
      this.pendingTranslations.clear();
    }
  }
  
  // Get current language
  getLanguage(): string {
    return this.language;
  }

  // A function that translates text
  async translateText(
    text: string, 
    sourceLanguage: string = 'en', 
    entryId?: number
  ): Promise<string> {
    if (!text || !text.trim() || this.language === 'en') {
      return text;
    }
    
    // Create a unique key for this translation request
    const translationKey = `${text}__${this.language}__${entryId || ''}`;
    
    // Check if this translation is already in progress
    if (this.pendingTranslations.has(translationKey)) {
      return this.pendingTranslations.get(translationKey)!;
    }
    
    // Create a new translation promise
    const translationPromise = (async () => {
      try {
        // Check cache first
        const cached = await translationCache.getTranslation(text, this.language);
        if (cached) {
          return cached.translatedText;
        }
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.mockTranslationDelay));
        
        // For demo purposes, we'll just modify the text slightly based on the language
        const translatedText = this.mockTranslate(text, this.language);
        
        // Cache the result
        await translationCache.setTranslation({
          originalText: text,
          translatedText: translatedText,
          language: this.language,
          timestamp: Date.now(),
          version: 1
        });
        
        return translatedText;
      } catch (error) {
        console.error("Static translation error:", error);
        return text;
      } finally {
        // Remove from pending translations when complete
        this.pendingTranslations.delete(translationKey);
      }
    })();
    
    // Store the promise so we can return it for duplicate requests
    this.pendingTranslations.set(translationKey, translationPromise);
    
    return translationPromise;
  }
  
  // Pre-translate multiple texts - used for batch operations
  async preTranslate(
    texts: string[],
    sourceLanguage: string = 'en'
  ): Promise<Map<string, string>> {
    return this.batchTranslateTexts(texts, sourceLanguage);
  }
  
  // Batch translate multiple texts at once
  async batchTranslateTexts(
    texts: string[],
    sourceLanguage: string = 'en'
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (!texts || texts.length === 0 || this.language === 'en') {
      // Return the original texts as-is for English
      texts.forEach(text => results.set(text, text));
      return results;
    }
    
    // Check cache and filter out texts that need translation
    const uncachedTexts: string[] = [];
    
    await Promise.all(
      texts.map(async (text) => {
        if (!text || !text.trim()) {
          results.set(text, text);
          return;
        }
        
        const cached = await translationCache.getTranslation(text, this.language);
        if (cached) {
          results.set(text, cached.translatedText);
        } else {
          uncachedTexts.push(text);
        }
      })
    );
    
    // Translate uncached texts
    if (uncachedTexts.length > 0) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, this.mockTranslationDelay));
      
      // Translate each text
      for (const text of uncachedTexts) {
        const translatedText = this.mockTranslate(text, this.language);
        results.set(text, translatedText);
        
        // Cache the result
        await translationCache.setTranslation({
          originalText: text,
          translatedText: translatedText,
          language: this.language,
          timestamp: Date.now(),
          version: 1
        });
      }
    }
    
    return results;
  }
  
  // Mock translate function - now with proper formatting that doesn't add language code prefix
  private mockTranslate(text: string, targetLang: string): string {
    if (targetLang === 'en') return text;
    
    // Instead of adding a language prefix, we'll simulate real translation
    // by adding some simple modifications based on the target language
    switch (targetLang) {
      case 'es':
        return text.length > 5 ? text + " (traducido)" : text;
      case 'fr':
        return text.length > 5 ? text + " (traduit)" : text;
      case 'de':
        return text.length > 5 ? text + " (übersetzt)" : text;
      case 'zh':
        return text.length > 5 ? text + " (已翻译)" : text;
      case 'ja':
        return text.length > 5 ? text + " (翻訳済み)" : text;
      case 'hi':
        return text.length > 5 ? text + " (अनुवादित)" : text;
      case 'ru':
        return text.length > 5 ? text + " (переведено)" : text;
      case 'ar':
        return text.length > 5 ? text + " (مترجم)" : text;
      case 'pt':
        return text.length > 5 ? text + " (traduzido)" : text;
      default:
        return text;
    }
  }
}

// Export a singleton
export const staticTranslationService = new StaticTranslationService();
