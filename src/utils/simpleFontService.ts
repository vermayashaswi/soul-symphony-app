
// Simplified font service that doesn't block rendering
class SimpleFontService {
  private fontsReady = false;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.initializeFonts();
  }

  private async initializeFonts(): Promise<void> {
    try {
      // Simple font readiness check without blocking
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      this.fontsReady = true;
      console.log('[SimpleFontService] Fonts ready');
    } catch (error) {
      console.warn('[SimpleFontService] Font check failed, proceeding anyway:', error);
      this.fontsReady = true; // Don't block on font errors
    }
  }

  async waitForFonts(): Promise<void> {
    return this.readyPromise;
  }

  isReady(): boolean {
    return this.fontsReady;
  }

  detectScriptType(text: string): string {
    if (!text) return 'latin';
    
    // Simple script detection
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
    if (/[\u4E00-\u9FFF]/.test(text)) return 'chinese';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
    if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
    
    return 'latin';
  }

  async preloadFontsForScript(scriptType: string): Promise<void> {
    // Non-blocking font preload
    console.log(`[SimpleFontService] Preloading fonts for ${scriptType}`);
    return Promise.resolve();
  }
}

export const simpleFontService = new SimpleFontService();
