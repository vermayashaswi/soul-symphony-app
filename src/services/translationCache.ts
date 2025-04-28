
// Translation cache service to improve performance

interface CacheEntry {
  value: string;
  timestamp: number;
  language: string;
}

interface TranslationEntry {
  originalText: string;
  translatedText: string;
  language: string;
  timestamp: number;
  version: number;
}

class TranslationCache {
  private cache: Record<string, Record<string, CacheEntry>> = {};
  private readonly TTL: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  constructor() {
    this.loadFromStorage();
    
    // Schedule periodic cleanup
    setInterval(() => this.cleanExpired(), 60 * 60 * 1000); // Clean every hour
  }
  
  public set(key: string, value: string, language: string): void {
    // Remove any language markers from the key before storing
    const cleanKey = this.removeLanguageMarkers(key);
    
    // Create language section if it doesn't exist
    if (!this.cache[language]) {
      this.cache[language] = {};
    }
    
    // Store the translation with timestamp
    this.cache[language][cleanKey] = {
      value,
      timestamp: Date.now(),
      language
    };
    
    // Save to storage (debounced)
    this.debouncedSave();
  }
  
  public get(key: string, language: string): string | null {
    try {
      // Remove any language markers from the key before retrieving
      const cleanKey = this.removeLanguageMarkers(key);
      
      // Check if we have this language and key
      if (!this.cache[language] || !this.cache[language][cleanKey]) {
        return null;
      }
      
      const entry = this.cache[language][cleanKey];
      
      // Check if the entry has expired
      if (Date.now() - entry.timestamp > this.TTL) {
        // Remove expired entry
        delete this.cache[language][cleanKey];
        return null;
      }
      
      // Return valid entry
      return entry.value;
    } catch (error) {
      console.error('Error retrieving from translation cache:', error);
      return null;
    }
  }
  
  // Method to remove language markers like [hi] from strings
  private removeLanguageMarkers(text: string): string {
    // Remove language markers like [hi], [en], etc.
    return text.replace(/\[\w+\]\s*/g, '');
  }
  
  // Methods to support the translationService interface
  public async getTranslation(text: string, language: string): Promise<TranslationEntry | null> {
    // Clean the input text of any language markers
    const cleanText = this.removeLanguageMarkers(text);
    
    const cachedValue = this.get(cleanText, language);
    if (cachedValue === null) return null;
    
    return {
      originalText: cleanText,
      translatedText: cachedValue,
      language,
      timestamp: Date.now(),
      version: 1
    };
  }
  
  public async setTranslation(entry: TranslationEntry): Promise<void> {
    // Clean the original text of any language markers
    const cleanText = this.removeLanguageMarkers(entry.originalText);
    this.set(cleanText, entry.translatedText, entry.language);
  }
  
  private cleanExpired(): void {
    const now = Date.now();
    let changed = false;
    
    // Check all languages
    Object.keys(this.cache).forEach(lang => {
      // Check all keys in this language
      Object.keys(this.cache[lang]).forEach(key => {
        const entry = this.cache[lang][key];
        if (now - entry.timestamp > this.TTL) {
          delete this.cache[lang][key];
          changed = true;
        }
      });
      
      // Remove empty language sections
      if (Object.keys(this.cache[lang]).length === 0) {
        delete this.cache[lang];
      }
    });
    
    // Save if we made changes
    if (changed) {
      this.saveToStorage();
    }
  }
  
  private saveToStorage(): void {
    try {
      // Store a simplified version of the cache (no timestamp needed)
      const simplified: Record<string, Record<string, string>> = {};
      
      Object.keys(this.cache).forEach(lang => {
        simplified[lang] = {};
        Object.keys(this.cache[lang]).forEach(key => {
          simplified[lang][key] = this.cache[lang][key].value;
        });
      });
      
      localStorage.setItem('translationCache', JSON.stringify(simplified));
    } catch (error) {
      console.error('Error saving translation cache to storage:', error);
    }
  }
  
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('translationCache');
      if (!stored) return;
      
      const simplified = JSON.parse(stored) as Record<string, Record<string, string>>;
      
      // Convert simplified format back to full format with timestamps
      Object.keys(simplified).forEach(lang => {
        this.cache[lang] = {};
        Object.keys(simplified[lang]).forEach(key => {
          this.cache[lang][key] = {
            value: simplified[lang][key],
            timestamp: Date.now(), // Reset timestamp on load
            language: lang
          };
        });
      });
    } catch (error) {
      console.error('Error loading translation cache from storage:', error);
    }
  }
  
  // Create a debounced save function to avoid excessive writes
  private saveTimeout: NodeJS.Timeout | null = null;
  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeout = null;
    }, 1000);
  }
}

export const translationCache = new TranslationCache();
