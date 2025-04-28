
// Translation cache service to improve performance

interface CacheEntry {
  value: string;
  timestamp: number;
  language: string;
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
    // Create language section if it doesn't exist
    if (!this.cache[language]) {
      this.cache[language] = {};
    }
    
    // Store the translation with timestamp
    this.cache[language][key] = {
      value,
      timestamp: Date.now(),
      language
    };
    
    // Save to storage (debounced)
    this.debouncedSave();
  }
  
  public get(key: string, language: string): string | null {
    try {
      // Check if we have this language and key
      if (!this.cache[language] || !this.cache[language][key]) {
        return null;
      }
      
      const entry = this.cache[language][key];
      
      // Check if the entry has expired
      if (Date.now() - entry.timestamp > this.TTL) {
        // Remove expired entry
        delete this.cache[language][key];
        return null;
      }
      
      // Return valid entry
      return entry.value;
    } catch (error) {
      console.error('Error retrieving from translation cache:', error);
      return null;
    }
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
