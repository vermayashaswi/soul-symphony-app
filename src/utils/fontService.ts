
import { simpleFontService } from './simpleFontService';
import { localFontService } from '@/services/localFontService';

// Unified font service that combines the best of both approaches
class FontService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[FontService] Initializing unified font service...');
      
      // Initialize both services in parallel
      await Promise.all([
        simpleFontService.waitForFonts(),
        // localFontService is already initialized synchronously
        Promise.resolve()
      ]);
      
      this.isInitialized = true;
      console.log('[FontService] Unified font service ready');
    } catch (error) {
      console.warn('[FontService] Initialization had issues, proceeding anyway:', error);
      this.isInitialized = true; // Don't block on font errors
    }
  }

  async waitForFonts(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  detectScriptType(text: string): string {
    // Use localFontService for consistent script detection
    return localFontService.detectScriptType(text);
  }

  getFontFamily(scriptType: string): string {
    // Use simpleFontService for CSS font families
    return simpleFontService.getFontFamily(scriptType);
  }

  // Add the missing getOptimalFontFamily method
  getOptimalFontFamily(scriptType: string): string {
    // This delegates to the existing getFontFamily method
    return this.getFontFamily(scriptType);
  }

  getFontFamilyForText(text: string): string {
    const scriptType = this.detectScriptType(text);
    return this.getFontFamily(scriptType);
  }

  // For Three.js font loading
  getFontUrl(fontName: string, preferLocal: boolean = true): string {
    return localFontService.getFontUrl(fontName, preferLocal);
  }

  getFontUrlForText(text: string, preferLocal: boolean = true): string {
    return localFontService.getFontUrlForText(text, preferLocal);
  }

  getFallbackUrl(fontName: string): string {
    return localFontService.getFallbackUrl(fontName);
  }

  // Font validation
  async validateFont(fontData: any, fontName: string, text?: string) {
    return localFontService.validateFont(fontData, fontName, text);
  }

  // Preload fonts for a specific script
  async preloadFontsForScript(scriptType: string): Promise<void> {
    try {
      // Preload CSS fonts
      await simpleFontService.preloadFontsForScript(scriptType);
      console.log(`[FontService] Preloaded CSS fonts for ${scriptType}`);
    } catch (error) {
      console.warn(`[FontService] CSS font preload failed for ${scriptType}:`, error);
    }
  }

  // Test Devanagari support
  testDevanagariSupport(text: string) {
    return localFontService.testDevanagariSupport(text);
  }

  // Get the best font configuration for a given text
  getBestFontConfig(text: string): {
    scriptType: string;
    cssFamily: string;
    threejsUrl: string;
    fallbackUrl: string;
    needsValidation: boolean;
  } {
    const scriptType = this.detectScriptType(text);
    const cssFamily = this.getFontFamily(scriptType);
    const threejsUrl = this.getFontUrlForText(text, true);
    const fallbackUrl = this.getFallbackUrl(localFontService.getFontNameForText(text));
    const needsValidation = scriptType !== 'latin';

    return {
      scriptType,
      cssFamily,
      threejsUrl,
      fallbackUrl,
      needsValidation
    };
  }
}

export const fontService = new FontService();
