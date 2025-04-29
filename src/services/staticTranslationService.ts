
// Add or update the translateText method to accept sourceLanguage
import { translationCache } from './translationCache';

class StaticTranslationService {
  private currentLanguage = 'en';

  setLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    // If target is English or text is empty, return as is
    if (targetLanguage === 'en' || !text) {
      return text;
    }

    try {
      // Check cache first (consider source language in cache key if provided)
      const cacheKey = sourceLanguage 
        ? `${sourceLanguage}:${targetLanguage}:${text}` 
        : `${targetLanguage}:${text}`;
      
      const cachedTranslation = await translationCache.getTranslation(cacheKey, targetLanguage);
      if (cachedTranslation) {
        console.log(`[Translation] Cache hit for ${text.substring(0, 20)}...`);
        return cachedTranslation.translatedText;
      }

      console.log(`[Translation] Translating "${text.substring(0, 20)}..." to ${targetLanguage}`);
      
      // Here you would call your actual translation service
      // For this example, we're using a mock that converts text based on language
      // In a real app, you'd call a translation API
      // Pass sourceLanguage to your translation service if available
      const translatedText = await this.mockTranslate(text, targetLanguage, sourceLanguage);
      
      // Cache the result
      await translationCache.setTranslation({
        originalText: cacheKey,
        translatedText: translatedText,
        language: targetLanguage,
        timestamp: Date.now(),
        version: 1
      });
      
      return translatedText;
    } catch (error) {
      console.error('[Translation] Error translating text:', error);
      return text; // Return original text on error
    }
  }

  // Mock translation for demo purposes - FIX THE IMPLEMENTATION
  private async mockTranslate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    // In a real app, this would be replaced with a call to a translation service API
    console.log(`[Translation] Mock translating from ${sourceLang || 'auto'} to ${targetLang}: ${text.substring(0, 20)}...`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Instead of just adding a language tag, let's provide some actual translations for common phrases
    // This is just a simple mock - in a real app, you would use a proper translation API
    if (targetLang === 'hi') {
      // Hindi translations for some common phrases
      if (text.includes("Journal")) return text.replace(/Journal/g, "डायरी");
      if (text.includes("Yash's")) return text.replace(/Yash's/g, "यश की");
      if (text.includes("7-day themes")) return text.replace(/7-day themes/g, "7-दिन के थीम्स");
      if (text.includes("The only journey is the one within.")) 
        return "एकमात्र यात्रा वह है जो भीतर है।";
      if (text.includes("Rainer Maria Rilke")) 
        return "रैनर मारिया रिल्के";
      if (text.includes("understanding machine learning"))
        return "मशीन लर्निंग को समझना";
      if (text.includes("enthusiasm for"))
        return "के लिए उत्साह";
      if (text.includes("exploring"))
        return "अन्वेषण";
      if (text.includes("growth"))
        return "विकास";
      if (text.includes("Tue,"))
        return text.replace(/Tue,/g, "मंगल,");
      if (text.includes("Apr"))
        return text.replace(/Apr/g, "अप्रैल");
    } else if (targetLang === 'es') {
      // Spanish translations for some common phrases
      if (text.includes("Journal")) return text.replace(/Journal/g, "Diario");
      if (text.includes("The only journey is the one within.")) 
        return "El único viaje es el que está dentro.";
    } else if (targetLang === 'fr') {
      // French translations for some common phrases
      if (text.includes("Journal")) return text.replace(/Journal/g, "Journal");
      if (text.includes("The only journey is the one within.")) 
        return "Le seul voyage est celui à l'intérieur.";
    }
    
    // If no specific translation is available, return original text
    // In a real implementation, all text would be translated
    return text;
  }
}

export const staticTranslationService = new StaticTranslationService();
