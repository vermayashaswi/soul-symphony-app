
// Enhanced font service with dynamic font selection
class SimpleFontService {
  private fontsReady = false;
  private readyPromise: Promise<void>;
  private fontMappings: Record<string, string[]> = {
    latin: ['Inter', 'system-ui', 'sans-serif'],
    devanagari: ['Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', 'sans-serif'],
    arabic: ['Noto Sans Arabic', 'Tahoma', 'Arial Unicode MS', 'sans-serif'],
    chinese: ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei', 'sans-serif'],
    japanese: ['Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'sans-serif'],
    korean: ['Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', 'sans-serif']
  };

  constructor() {
    this.readyPromise = this.initializeFonts();
  }

  private async initializeFonts(): Promise<void> {
    try {
      // Load Google Fonts for better script support
      this.loadGoogleFonts();
      
      // Simple font readiness check without blocking
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      this.fontsReady = true;
      console.log('[SimpleFontService] Enhanced fonts ready with script support');
    } catch (error) {
      console.warn('[SimpleFontService] Font check failed, proceeding anyway:', error);
      this.fontsReady = true; // Don't block on font errors
    }
  }

  private loadGoogleFonts(): void {
    // Check if Google Fonts are already loaded
    if (document.querySelector('link[href*="fonts.googleapis.com"]')) {
      return;
    }

    // Load essential Google Fonts for better script support
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Arabic:wght@400;600&family=Noto+Sans+SC:wght@400;600&family=Noto+Sans+JP:wght@400;600&family=Noto+Sans+KR:wght@400;600&display=swap';
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontUrl;
    document.head.appendChild(link);
    
    console.log('[SimpleFontService] Google Fonts loaded for enhanced script support');
  }

  async waitForFonts(): Promise<void> {
    return this.readyPromise;
  }

  isReady(): boolean {
    return this.fontsReady;
  }

  detectScriptType(text: string): string {
    if (!text) return 'latin';
    
    // Enhanced script detection with better Unicode ranges
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'arabic';
    if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'chinese';
    if (/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/.test(text)) return 'japanese';
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) return 'korean';
    
    return 'latin';
  }

  getFontFamily(scriptType: string): string {
    const fonts = this.fontMappings[scriptType] || this.fontMappings.latin;
    return fonts.join(', ');
  }

  getFontFamilyForText(text: string): string {
    const scriptType = this.detectScriptType(text);
    return this.getFontFamily(scriptType);
  }

  async preloadFontsForScript(scriptType: string): Promise<void> {
    // Non-blocking font preload
    console.log(`[SimpleFontService] Preloading fonts for ${scriptType}`);
    return Promise.resolve();
  }

  async testFontLoading(fontFamily: string): Promise<boolean> {
    try {
      // Simple font availability test using document.fonts API if available
      if (document.fonts && document.fonts.check) {
        // Test if the font is available by checking a common character
        const isAvailable = document.fonts.check('12px ' + fontFamily, 'A');
        console.log(`[SimpleFontService] Font availability test for "${fontFamily}": ${isAvailable}`);
        return isAvailable;
      }

      // Fallback: assume font is available if fonts are ready
      console.log(`[SimpleFontService] Font API not available, assuming "${fontFamily}" is loaded`);
      return this.fontsReady;
    } catch (error) {
      console.warn(`[SimpleFontService] Font loading test failed for "${fontFamily}":`, error);
      return false;
    }
  }
}

export const simpleFontService = new SimpleFontService();
