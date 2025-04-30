
// Create a new service that doesn't depend on the database
// This is used for demo purposes only

import { translationCache } from './translationCache';
import { toast } from 'sonner';

// A basic static translation service that uses mock translations
class StaticTranslationService {
  private language: string = 'en';
  private mockTranslationDelay: number = 200; // 200ms delay to simulate API call
  
  // Change the language
  setLanguage(lang: string): void {
    if (this.language !== lang) {
      console.log(`StaticTranslationService: Changing language to ${lang}`);
      this.language = lang;
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
    }
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
  
  // Mock translate function
  private mockTranslate(text: string, targetLang: string): string {
    if (targetLang === 'en') return text;
    
    // Very simple mock translations for demo purposes
    switch (targetLang) {
      case 'es':
        return `[ES] ${text}`;
      case 'fr':
        return `[FR] ${text}`;
      case 'de':
        return `[DE] ${text}`;
      case 'zh':
        return `[ZH] ${text}`;
      case 'ja':
        return `[JA] ${text}`;
      case 'hi':
        return `[HI] ${text}`;
      case 'ru':
        return `[RU] ${text}`;
      case 'ar':
        return `[AR] ${text}`;
      case 'pt':
        return `[PT] ${text}`;
      default:
        return text;
    }
  }
}

// Export a singleton
export const staticTranslationService = new StaticTranslationService();
