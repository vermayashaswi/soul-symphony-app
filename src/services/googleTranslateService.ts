
interface GoogleTranslateAPI {
  translate: {
    TranslateElement: {
      new (options: any, elementId: string): any;
      InlineLayout: {
        HORIZONTAL: any;
        SIMPLE: any;
        VERTICAL: any;
      };
    };
  };
}

declare global {
  interface Window {
    google: GoogleTranslateAPI;
    googleTranslateElementInit: () => void;
  }
}

class GoogleTranslateService {
  private isInitialized = false;
  private translationCache = new Map<string, Map<string, string>>();
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      console.log('[GoogleTranslateService] Initializing...');
      
      // Check if Google Translate is already loaded
      if (window.google?.translate?.TranslateElement) {
        this.isInitialized = true;
        console.log('[GoogleTranslateService] Already initialized');
        resolve();
        return;
      }

      // Wait for Google Translate to load
      const checkInterval = setInterval(() => {
        if (window.google?.translate?.TranslateElement) {
          clearInterval(checkInterval);
          this.isInitialized = true;
          console.log('[GoogleTranslateService] Initialized successfully');
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!this.isInitialized) {
          console.warn('[GoogleTranslateService] Initialization timeout');
          reject(new Error('Google Translate initialization timeout'));
        }
      }, 10000);
    });

    return this.initPromise;
  }

  async translateText(text: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    if (!text || !text.trim()) return '';
    
    // Check cache first
    const cacheKey = `${sourceLang}-${targetLang}`;
    const languageCache = this.translationCache.get(cacheKey);
    if (languageCache?.has(text)) {
      const cached = languageCache.get(text);
      if (cached) {
        console.log(`[GoogleTranslateService] Cache hit for "${text.substring(0, 30)}..."`);
        return cached;
      }
    }

    try {
      await this.initialize();
      
      // Use Google Translate API if available
      if (window.google?.translate) {
        const result = await this.performTranslation(text, targetLang, sourceLang);
        
        // Cache the result
        this.cacheTranslation(text, result, cacheKey);
        
        return result;
      }
      
      console.warn('[GoogleTranslateService] Google Translate not available, returning original text');
      return text;
    } catch (error) {
      console.error('[GoogleTranslateService] Translation error:', error);
      return text;
    }
  }

  private async performTranslation(text: string, targetLang: string, sourceLang: string): Promise<string> {
    // This is a simplified implementation
    // In a real scenario, you'd use the Google Translate API endpoint
    console.log(`[GoogleTranslateService] Translating "${text.substring(0, 30)}..." from ${sourceLang} to ${targetLang}`);
    
    // For now, return the original text
    // This would be replaced with actual API call
    return text;
  }

  private cacheTranslation(text: string, translation: string, cacheKey: string): void {
    let languageCache = this.translationCache.get(cacheKey);
    if (!languageCache) {
      languageCache = new Map();
      this.translationCache.set(cacheKey, languageCache);
    }
    languageCache.set(text, translation);
  }

  clearCache(): void {
    this.translationCache.clear();
    console.log('[GoogleTranslateService] Cache cleared');
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const googleTranslateService = new GoogleTranslateService();
export default googleTranslateService;
