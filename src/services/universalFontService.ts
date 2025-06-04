interface FontConfig {
  name: string;
  url: string;
  scripts: string[];
  fallback: string;
  languages: string[];
}

class UniversalFontService {
  private fonts: FontConfig[] = [
    {
      name: 'Helvetiker',
      url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
      scripts: ['latin'],
      fallback: 'Arial, sans-serif',
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt']
    },
    {
      name: 'Noto Sans Devanagari',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json',
      scripts: ['devanagari'],
      fallback: 'Noto Sans Devanagari, Arial, sans-serif',
      languages: ['hi', 'mr', 'ne', 'sa']
    },
    {
      name: 'Noto Sans Arabic',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_arabic_regular.typeface.json',
      scripts: ['arabic'],
      fallback: 'Noto Sans Arabic, Arial, sans-serif',
      languages: ['ar', 'fa', 'ur']
    },
    {
      name: 'Noto Sans Bengali',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_bengali_regular.typeface.json',
      scripts: ['bengali'],
      fallback: 'Noto Sans Bengali, Arial, sans-serif',
      languages: ['bn', 'as']
    },
    {
      name: 'Noto Sans Tamil',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_tamil_regular.typeface.json',
      scripts: ['tamil'],
      fallback: 'Noto Sans Tamil, Arial, sans-serif',
      languages: ['ta']
    },
    {
      name: 'Noto Sans Telugu',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_telugu_regular.typeface.json',
      scripts: ['telugu'],
      fallback: 'Noto Sans Telugu, Arial, sans-serif',
      languages: ['te']
    },
    {
      name: 'Noto Sans Gujarati',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_gujarati_regular.typeface.json',
      scripts: ['gujarati'],
      fallback: 'Noto Sans Gujarati, Arial, sans-serif',
      languages: ['gu']
    },
    {
      name: 'Noto Sans Kannada',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_kannada_regular.typeface.json',
      scripts: ['kannada'],
      fallback: 'Noto Sans Kannada, Arial, sans-serif',
      languages: ['kn']
    },
    {
      name: 'Noto Sans Malayalam',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_malayalam_regular.typeface.json',
      scripts: ['malayalam'],
      fallback: 'Noto Sans Malayalam, Arial, sans-serif',
      languages: ['ml']
    },
    {
      name: 'Noto Sans Gurmukhi',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_gurmukhi_regular.typeface.json',
      scripts: ['gurmukhi'],
      fallback: 'Noto Sans Gurmukhi, Arial, sans-serif',
      languages: ['pa']
    },
    {
      name: 'Noto Sans Oriya',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_oriya_regular.typeface.json',
      scripts: ['oriya'],
      fallback: 'Noto Sans Oriya, Arial, sans-serif',
      languages: ['or']
    },
    {
      name: 'Noto Sans CJK',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_cjk_regular.typeface.json',
      scripts: ['cjk'],
      fallback: 'Noto Sans CJK, Arial, sans-serif',
      languages: ['zh', 'ja', 'ko']
    },
    {
      name: 'Noto Sans Cyrillic',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_cyrillic_regular.typeface.json',
      scripts: ['cyrillic'],
      fallback: 'Noto Sans, Arial, sans-serif',
      languages: ['ru', 'bg', 'uk', 'sr']
    }
  ];

  private fontCache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private fallbackFonts = new Map<string, FontConfig>();

  constructor() {
    // Initialize fallback mapping
    this.initializeFallbackMapping();
  }

  private initializeFallbackMapping(): void {
    // Create fallback mapping for better script detection
    this.fonts.forEach(font => {
      font.scripts.forEach(script => {
        if (!this.fallbackFonts.has(script)) {
          this.fallbackFonts.set(script, font);
        }
      });
    });
  }

  detectScript(text: string): string {
    if (!text) return 'latin';
    
    // Enhanced script detection with more comprehensive Unicode ranges
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
    if (/[\u0A00-\u0A7F]/.test(text)) return 'gurmukhi';
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gujarati';
    if (/[\u0B00-\u0B7F]/.test(text)) return 'oriya';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kannada';
    if (/[\u0D00-\u0D7F]/.test(text)) return 'malayalam';
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'arabic';
    if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'cjk'; // Chinese
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'cjk'; // Japanese
    if (/[\uAC00-\uD7AF]/.test(text)) return 'cjk'; // Korean
    if (/[\u0400-\u04FF\u0500-\u052F]/.test(text)) return 'cyrillic';
    
    return 'latin';
  }

  detectLanguage(text: string, currentLanguage?: string): string {
    // If we have current language context, use it
    if (currentLanguage && currentLanguage !== 'en') {
      return currentLanguage;
    }
    
    // Otherwise detect by script
    const script = this.detectScript(text);
    const fontConfig = this.fallbackFonts.get(script);
    if (fontConfig && fontConfig.languages.length > 0) {
      return fontConfig.languages[0];
    }
    
    return 'en';
  }

  getFontConfig(text: string, language?: string): FontConfig {
    const detectedLanguage = this.detectLanguage(text, language);
    const script = this.detectScript(text);
    
    // Try to find font by language first
    let font = this.fonts.find(f => f.languages.includes(detectedLanguage));
    
    // If not found, try by script
    if (!font) {
      font = this.fonts.find(f => f.scripts.includes(script));
    }
    
    // Final fallback to Latin
    const fallbackFont = this.fonts.find(f => f.scripts.includes('latin'));
    
    const selectedFont = font || fallbackFont || this.fonts[0];
    
    console.log(`[UniversalFontService] Font selection for "${text.substring(0, 20)}...": language=${detectedLanguage}, script=${script}, font=${selectedFont.name}`);
    
    return selectedFont;
  }

  async loadFont(text: string, language?: string): Promise<any> {
    const config = this.getFontConfig(text, language);
    
    // Check cache first
    if (this.fontCache.has(config.url)) {
      console.log(`[UniversalFontService] Cache hit for font: ${config.name}`);
      return this.fontCache.get(config.url);
    }

    // Check if already loading
    if (this.loadingPromises.has(config.url)) {
      console.log(`[UniversalFontService] Font already loading: ${config.name}`);
      return this.loadingPromises.get(config.url);
    }

    // Start loading
    console.log(`[UniversalFontService] Loading font: ${config.name} for text: "${text.substring(0, 20)}..."`);
    const loadingPromise = this.loadFontFromUrl(config.url, config.name);
    this.loadingPromises.set(config.url, loadingPromise);

    try {
      const font = await loadingPromise;
      this.fontCache.set(config.url, font);
      this.loadingPromises.delete(config.url);
      console.log(`[UniversalFontService] Successfully loaded font: ${config.name}`);
      return font;
    } catch (error) {
      this.loadingPromises.delete(config.url);
      console.error(`[UniversalFontService] Failed to load font: ${config.name}`, error);
      
      // Try to fallback to Latin font
      const fallbackConfig = this.fonts.find(f => f.scripts.includes('latin'));
      if (fallbackConfig && fallbackConfig.url !== config.url) {
        console.log(`[UniversalFontService] Attempting fallback to: ${fallbackConfig.name}`);
        return this.loadFont('fallback', 'en');
      }
      
      throw error;
    }
  }

  private async loadFontFromUrl(url: string, fontName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const loader = new (window as any).THREE.FontLoader();
      
      // Add timeout for font loading
      const timeout = setTimeout(() => {
        reject(new Error(`Font loading timeout for ${fontName}`));
      }, 10000);
      
      loader.load(
        url,
        (font: any) => {
          clearTimeout(timeout);
          resolve(font);
        },
        (progress: any) => {
          console.log(`[UniversalFontService] Loading progress for ${fontName}: ${(progress.loaded / progress.total * 100)}%`);
        },
        (error: any) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    });
  }

  getFallbackFont(text: string, language?: string): string {
    const config = this.getFontConfig(text, language);
    return config.fallback;
  }

  isComplexScript(text: string): boolean {
    const script = this.detectScript(text);
    return script !== 'latin';
  }

  // Get the appropriate font URL for simplified font service compatibility
  getFontUrl(text: string, language?: string): string {
    const config = this.getFontConfig(text, language);
    return config.url;
  }

  // Clear cache
  clearCache(): void {
    console.log('[UniversalFontService] Clearing font cache');
    this.fontCache.clear();
    this.loadingPromises.clear();
  }

  // Get cache stats
  getCacheStats(): { cached: number, loading: number } {
    return {
      cached: this.fontCache.size,
      loading: this.loadingPromises.size
    };
  }
}

export const universalFontService = new UniversalFontService();
