
// Enhanced Font Service for Multi-Script Support
export class FontService {
  private static instance: FontService;
  private fontsReady: boolean = false;
  private loadingPromise: Promise<boolean> | null = null;
  private fontCheckCache = new Map<string, boolean>();

  private constructor() {
    this.initializeFontDetection();
  }

  public static getInstance(): FontService {
    if (!FontService.instance) {
      FontService.instance = new FontService();
    }
    return FontService.instance;
  }

  private initializeFontDetection(): void {
    // Check if fonts are already ready
    if ((window as any).__SOULO_FONTS_READY__) {
      this.fontsReady = true;
      return;
    }

    // Listen for font ready event
    window.addEventListener('fontsReady', () => {
      this.fontsReady = true;
      console.log('[FontService] Fonts ready event received');
    });
  }

  public async waitForFonts(): Promise<boolean> {
    if (this.fontsReady) {
      return true;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise((resolve) => {
      if (this.fontsReady) {
        resolve(true);
        return;
      }

      const checkReady = () => {
        if (this.fontsReady || (window as any).__SOULO_FONTS_READY__) {
          this.fontsReady = true;
          resolve(true);
        }
      };

      // Listen for font ready event
      window.addEventListener('fontsReady', checkReady);

      // Fallback timeout
      setTimeout(() => {
        console.warn('[FontService] Font loading timeout, proceeding anyway');
        this.fontsReady = true;
        resolve(true);
      }, 5000);

      // Initial check
      checkReady();
    });

    return this.loadingPromise;
  }

  public isFontAvailable(fontFamily: string): boolean {
    if (this.fontCheckCache.has(fontFamily)) {
      return this.fontCheckCache.get(fontFamily)!;
    }

    try {
      if (document.fonts && document.fonts.check) {
        const isAvailable = document.fonts.check(`12px "${fontFamily}"`);
        this.fontCheckCache.set(fontFamily, isAvailable);
        return isAvailable;
      }
    } catch (error) {
      console.warn(`[FontService] Error checking font ${fontFamily}:`, error);
    }

    // Fallback: assume available
    this.fontCheckCache.set(fontFamily, true);
    return true;
  }

  public getOptimalFontFamily(scriptType: string): string {
    const fontMappings = {
      'devanagari': 'Noto Sans Devanagari, Mukti, Lohit Devanagari, Noto Sans, Inter, system-ui, sans-serif',
      'arabic': 'Noto Sans Arabic, Amiri, Noto Sans, Inter, system-ui, sans-serif',
      'chinese': 'Noto Sans SC, Noto Sans TC, Noto Sans, Inter, system-ui, sans-serif',
      'japanese': 'Noto Sans JP, M PLUS 1p, Noto Sans, Inter, system-ui, sans-serif',
      'korean': 'Noto Sans KR, Noto Sans, Inter, system-ui, sans-serif',
      'bengali': 'Noto Sans Bengali, Noto Sans, Inter, system-ui, sans-serif',
      'tamil': 'Noto Sans Tamil, Noto Sans, Inter, system-ui, sans-serif',
      'telugu': 'Noto Sans Telugu, Noto Sans, Inter, system-ui, sans-serif',
      'gujarati': 'Noto Sans Gujarati, Noto Sans, Inter, system-ui, sans-serif',
      'kannada': 'Noto Sans Kannada, Noto Sans, Inter, system-ui, sans-serif',
      'malayalam': 'Noto Sans Malayalam, Noto Sans, Inter, system-ui, sans-serif',
      'oriya': 'Noto Sans Oriya, Noto Sans, Inter, system-ui, sans-serif',
      'gurmukhi': 'Noto Sans Gurmukhi, Noto Sans, Inter, system-ui, sans-serif',
      'thai': 'Noto Sans Thai, Noto Sans, Inter, system-ui, sans-serif',
      'latin': 'Inter, Noto Sans, system-ui, -apple-system, sans-serif'
    };

    return fontMappings[scriptType as keyof typeof fontMappings] || fontMappings.latin;
  }

  public detectScriptType(text: string): string {
    if (!text) return 'latin';

    const scriptPatterns = {
      'devanagari': /[\u0900-\u097F]/,
      'arabic': /[\u0600-\u06FF]/,
      'chinese': /[\u4E00-\u9FFF]/,
      'japanese': /[\u3040-\u309F\u30A0-\u30FF]/,
      'korean': /[\uAC00-\uD7AF]/,
      'bengali': /[\u0980-\u09FF]/,
      'tamil': /[\u0B80-\u0BFF]/,
      'telugu': /[\u0C00-\u0C7F]/,
      'gujarati': /[\u0A80-\u0AFF]/,
      'kannada': /[\u0C80-\u0CFF]/,
      'malayalam': /[\u0D00-\u0D7F]/,
      'oriya': /[\u0B00-\u0B7F]/,
      'gurmukhi': /[\u0A00-\u0A7F]/,
      'thai': /[\u0E00-\u0E7F]/
    };

    for (const [script, pattern] of Object.entries(scriptPatterns)) {
      if (pattern.test(text)) {
        return script;
      }
    }

    return 'latin';
  }

  public async preloadFontsForScript(scriptType: string): Promise<void> {
    const fontFamily = this.getOptimalFontFamily(scriptType);
    const primaryFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '');

    try {
      if (document.fonts && !this.isFontAvailable(primaryFont)) {
        console.log(`[FontService] Preloading font for script: ${scriptType}`);
        const fontFace = new FontFace(primaryFont, `local("${primaryFont}")`);
        await fontFace.load();
        document.fonts.add(fontFace);
        console.log(`[FontService] Font ${primaryFont} preloaded successfully`);
      }
    } catch (error) {
      console.warn(`[FontService] Failed to preload font ${primaryFont}:`, error);
    }
  }

  public getFontLoadingClass(scriptType: string): string {
    return `font-${scriptType}`;
  }

  public isReady(): boolean {
    return this.fontsReady;
  }
}

export const fontService = FontService.getInstance();
