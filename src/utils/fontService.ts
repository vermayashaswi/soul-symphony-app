
import { simpleFontService } from './simpleFontService';
import { localFontService } from '@/services/localFontService';
import { threejsFontService } from '@/services/threejsFontService';

// Unified font service that combines the best of all approaches
class FontService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[FontService] Initializing unified font service...');
      
      // Initialize all services in parallel
      await Promise.all([
        simpleFontService.waitForFonts(),
        threejsFontService.preloadFonts(['Helvetiker', 'Noto Sans Devanagari', 'Optimer']),
        Promise.resolve() // localFontService is already initialized synchronously
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
    return localFontService.detectScriptType(text);
  }

  getFontFamily(scriptType: string): string {
    return simpleFontService.getFontFamily(scriptType);
  }

  getOptimalFontFamily(scriptType: string): string {
    return this.getFontFamily(scriptType);
  }

  getFontFamilyForText(text: string): string {
    const scriptType = this.detectScriptType(text);
    return this.getFontFamily(scriptType);
  }

  // For Three.js font loading with validation
  getFontUrl(fontName: string, preferLocal: boolean = true): string {
    return localFontService.getFontUrl(fontName, preferLocal);
  }

  getFontUrlForText(text: string, preferLocal: boolean = true): string {
    return localFontService.getFontUrlForText(text, preferLocal);
  }

  getFallbackUrl(fontName: string): string {
    return localFontService.getFallbackUrl(fontName);
  }

  // Enhanced font validation
  async validateFont(fontData: any, fontName: string, text?: string) {
    return localFontService.validateFont(fontData, fontName, text);
  }

  // Three.js font loading with validation
  async loadThreeJSFont(fontName: string) {
    return threejsFontService.loadFont(fontName);
  }

  async loadThreeJSFontForText(text: string) {
    return threejsFontService.loadFontForText(text);
  }

  // Preload fonts for a specific script
  async preloadFontsForScript(scriptType: string): Promise<void> {
    try {
      // Preload CSS fonts
      await simpleFontService.preloadFontsForScript(scriptType);
      
      // Preload Three.js fonts for the script
      const fontName = localFontService.getFontNameForScript(scriptType);
      await threejsFontService.loadFont(fontName);
      
      console.log(`[FontService] Preloaded fonts for ${scriptType}`);
    } catch (error) {
      console.warn(`[FontService] Font preload failed for ${scriptType}:`, error);
    }
  }

  // Test Devanagari support across all services
  async testDevanagariSupport(text: string): Promise<{
    localService: any;
    threejsService: any;
    cssSupport: boolean;
    validationResult?: any;
  }> {
    const localResult = localFontService.testDevanagariSupport(text);
    const threejsResult = threejsFontService.testDevanagariSupport(text);
    
    // Test CSS font loading
    const cssFamily = this.getFontFamilyForText(text);
    const cssSupport = await simpleFontService.testFontLoading(cssFamily);
    
    // Get validation result if available
    const validationResult = localFontService.getValidationResult(localResult.fontName);
    
    return {
      localService: localResult,
      threejsService: threejsResult,
      cssSupport,
      validationResult
    };
  }

  // Get the best font configuration for a given text
  getBestFontConfig(text: string): {
    scriptType: string;
    cssFamily: string;
    threejsUrl: string;
    fallbackUrl: string;
    needsValidation: boolean;
    fontName: string;
  } {
    const scriptType = this.detectScriptType(text);
    const fontName = localFontService.getFontNameForScript(scriptType);
    const cssFamily = this.getFontFamily(scriptType);
    const threejsUrl = this.getFontUrlForText(text, true);
    const fallbackUrl = this.getFallbackUrl(fontName);
    const needsValidation = scriptType !== 'latin';

    return {
      scriptType,
      cssFamily,
      threejsUrl,
      fallbackUrl,
      needsValidation,
      fontName
    };
  }

  // Comprehensive font health check
  async performFontHealthCheck(text?: string): Promise<{
    services: {
      simple: boolean;
      local: boolean;
      threejs: boolean;
    };
    fontSupport: Record<string, boolean>;
    validationResults: Record<string, any>;
    recommendations: string[];
  }> {
    const result = {
      services: {
        simple: simpleFontService.isReady(),
        local: localFontService.isReady(),
        threejs: threejsFontService.isReady()
      },
      fontSupport: {} as Record<string, boolean>,
      validationResults: {} as Record<string, any>,
      recommendations: [] as string[]
    };

    // Test font support for different scripts
    const testTexts = {
      latin: 'Hello World',
      devanagari: text || 'नमस्ते',
      arabic: 'مرحبا',
      chinese: '你好'
    };

    for (const [script, testText] of Object.entries(testTexts)) {
      try {
        const config = this.getBestFontConfig(testText);
        result.fontSupport[script] = true;
        
        if (config.needsValidation) {
          const fontUrl = config.threejsUrl;
          try {
            const response = await fetch(fontUrl);
            const fontData = await response.json();
            const validation = await this.validateFont(fontData, config.fontName, testText);
            result.validationResults[script] = validation;
            
            if (!validation.isValid) {
              result.recommendations.push(`Font validation failed for ${script}: ${validation.issues.join(', ')}`);
            }
          } catch (error) {
            result.recommendations.push(`Could not validate font for ${script}: ${error}`);
          }
        }
      } catch (error) {
        result.fontSupport[script] = false;
        result.recommendations.push(`Font support check failed for ${script}: ${error}`);
      }
    }

    return result;
  }
}

export const fontService = new FontService();
