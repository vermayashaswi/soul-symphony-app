
import { translationCache } from './translationCache';

class StaticTranslationService {
  private language = 'en';
  private translationQueue: Map<string, Promise<string>> = new Map();
  
  // Static translations for common UI text elements
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
    
    // Check for static translations first
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
  
  // Add the missing preTranslate method to batch translate multiple strings at once
  async preTranslate(texts: string[], sourceLanguage: string = 'en'): Promise<Map<string, string>> {
    if (this.language === 'en' || !texts || texts.length === 0) {
      // If target language is English or no texts to translate, return original texts
      const resultMap = new Map<string, string>();
      texts.forEach(text => resultMap.set(text, text));
      return resultMap;
    }
    
    console.log(`StaticTranslationService: Batch translating ${texts.length} items to ${this.language}`);
    
    const translationMap = new Map<string, string>();
    const translationPromises: Promise<void>[] = [];
    
    // Process each text in the array
    for (const text of texts) {
      if (!text || text.trim() === '') {
        translationMap.set(text, text);
        continue;
      }
      
      // Check for static translations first
      if (this.staticTranslations[this.language]?.[text]) {
        translationMap.set(text, this.staticTranslations[this.language][text]);
        continue;
      }
      
      const translationPromise = (async () => {
        try {
          // Try to get from cache first
          const cached = await translationCache.getTranslation(text, this.language);
          if (cached?.translatedText) {
            translationMap.set(text, cached.translatedText);
            return;
          }
          
          // If not in cache, translate and store
          const translatedText = await this.fetchTranslation(text, sourceLanguage);
          translationMap.set(text, translatedText);
        } catch (error) {
          console.error(`Error translating text: "${text.substring(0, 20)}..."`, error);
          translationMap.set(text, text); // Fallback to original on error
        }
      })();
      
      translationPromises.push(translationPromise);
    }
    
    // Wait for all translations to complete
    await Promise.all(translationPromises);
    console.log(`StaticTranslationService: Completed batch translation of ${texts.length} items`);
    
    return translationMap;
  }
  
  private async fetchTranslation(text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string> {
    // For debugging/development, we're using a simple mock translation
    // that prepends the target language code to show it's been "translated"
    
    // Log what's being translated
    console.log(`StaticTranslationService: Translating to ${this.language}: "${text.substring(0, 30)}..."`);
    
    // This is a mock translation for debugging - in production this would call an API
    // Hindi Translation Mock
    if (this.language === 'hi') {
      // For Hindi, use transliterated Hindi to show it's "translated"
      // Use a mock mapping of common English words to Hindi
      const mockHindiDict: {[key: string]: string} = {
        'the': 'यह',
        'a': 'एक',
        'is': 'है',
        'to': 'को',
        'in': 'में',
        'for': 'के लिए',
        'back': 'वापस',
        'online': 'ऑनलाइन',
        'your': 'आपका',
        'has': 'है',
        'been': 'हो गया',
        'restored': 'बहाल',
        'offline': 'ऑफ़लाइन',
        'some': 'कुछ',
        'content': 'सामग्री',
        'may': 'सकता',
        'not': 'नहीं',
        'be': 'हो',
        'available': 'उपलब्ध',
        'slow': 'धीमी',
        'connection': 'कनेक्शन',
        'detected': 'का पता चला',
        'loading': 'लोड हो रहा है',
        'optimized': 'अनुकूलित',
        'speed': 'गति',
        'analysis': 'विश्लेषण',
        'unknown': 'अज्ञात',
        'date': 'दिनांक',
        'journal': 'जर्नल',
        'entries': 'प्रविष्टियां',
        'more': 'अधिक',
        'entry': 'प्रविष्टि',
        'delete': 'हटाएं',
        'this': 'यह',
        'conversation': 'बातचीत',
        'cancel': 'रद्द करें',
        'hour': 'घंटा',
        'hours': 'घंटे',
        'day': 'दिन',
        'days': 'दिनों',
        'week': 'सप्ताह',
        'weeks': 'सप्ताह',
        'month': 'महीना',
        'months': 'महीने',
        'year': 'वर्ष',
        'years': 'साल',
        'ago': 'पहले',
      };
      
      // Simple word-by-word mock translation
      let translatedText = text;
      Object.keys(mockHindiDict).forEach(word => {
        // Use word boundary regex to replace whole words only
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        translatedText = translatedText.replace(regex, mockHindiDict[word]);
      });
      
      // Make the translation longer to simulate real translations
      translatedText = `${translatedText} (${this.language})`;
      
      // Store in cache
      await translationCache.setTranslation({
        originalText: text,
        translatedText: translatedText,
        language: this.language,
        timestamp: Date.now(),
        version: 1,
      });
      
      return translatedText;
    }
    
    // For other languages, just add a suffix to show it was "translated"
    const translatedText = `${text} (${this.language})`;
    
    // Store in cache
    await translationCache.setTranslation({
      originalText: text,
      translatedText: translatedText,
      language: this.language,
      timestamp: Date.now(),
      version: 1,
    });
    
    return translatedText;
  }
}

export const staticTranslationService = new StaticTranslationService();
