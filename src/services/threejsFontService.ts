
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { localFontService } from './localFontService';

interface FontInfo {
  name: string;
  url: string;
  font?: Font;
  loading?: Promise<Font>;
  error?: Error;
  validated?: boolean;
}

class ThreeJSFontService {
  private fonts: Map<string, FontInfo> = new Map();
  private fallbackFont: Font | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeFonts();
  }

  private initializeFonts() {
    // Register available fonts with their URLs
    const fontConfigs: FontInfo[] = [
      {
        name: 'Inter',
        url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json'
      },
      {
        name: 'Noto Sans Devanagari',
        url: '/fonts/noto_sans_devanagari_regular.typeface.json'
      },
      {
        name: 'Helvetiker',
        url: '/fonts/helvetiker_regular.typeface.json'
      },
      {
        name: 'Gentilis',
        url: 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json'
      },
      {
        name: 'Optimer',
        url: '/fonts/optimer_regular.typeface.json'
      }
    ];

    fontConfigs.forEach(config => {
      this.fonts.set(config.name, config);
    });

    this.isInitialized = true;
  }

  detectScriptType(text: string): string {
    return localFontService.detectScriptType(text);
  }

  getFontNameForScript(scriptType: string): string {
    return localFontService.getFontNameForScript(scriptType);
  }

  getFontNameForText(text: string): string {
    const fontName = localFontService.getFontNameForText(text);
    console.log(`[ThreeJSFontService] Text: "${text}" -> Font: ${fontName}`);
    return fontName;
  }

  async loadFont(fontName: string): Promise<Font | null> {
    const fontInfo = this.fonts.get(fontName);
    if (!fontInfo) {
      console.warn(`[ThreeJSFontService] Font not found: ${fontName}, using fallback`);
      return this.getFallbackFont();
    }

    // Return cached font if available and validated
    if (fontInfo.font && fontInfo.validated) {
      return fontInfo.font;
    }

    // Return existing loading promise if in progress
    if (fontInfo.loading) {
      try {
        return await fontInfo.loading;
      } catch (error) {
        console.error(`[ThreeJSFontService] Font loading failed: ${fontName}`, error);
        return this.getFallbackFont();
      }
    }

    // Start loading the font
    fontInfo.loading = this.loadAndValidateFont(fontInfo.url, fontName);
    
    try {
      const font = await fontInfo.loading;
      fontInfo.font = font;
      fontInfo.validated = true;
      delete fontInfo.loading;
      console.log(`[ThreeJSFontService] Font loaded and validated successfully: ${fontName}`);
      return font;
    } catch (error) {
      fontInfo.error = error instanceof Error ? error : new Error('Unknown font loading error');
      delete fontInfo.loading;
      console.error(`[ThreeJSFontService] Font loading failed: ${fontName}, using fallback`, error);
      return this.getFallbackFont();
    }
  }

  private async loadAndValidateFont(url: string, fontName: string): Promise<Font> {
    // First load the font data for validation
    const fontDataResponse = await fetch(url);
    if (!fontDataResponse.ok) {
      throw new Error(`Failed to fetch font data from ${url}`);
    }
    
    const fontData = await fontDataResponse.json();
    
    // Validate the font data using localFontService
    const validationResult = await localFontService.validateFont(fontData, fontName);
    
    if (!validationResult.isValid) {
      console.warn(`[ThreeJSFontService] Font validation failed for ${fontName}:`, validationResult.issues);
      // Still try to load it, but log the issues
    }

    return new Promise((resolve, reject) => {
      // Dynamic import to avoid bundling issues
      import('three/examples/jsm/loaders/FontLoader.js').then(({ FontLoader }) => {
        const loader = new FontLoader();
        loader.load(
          url,
          (font) => {
            console.log(`[ThreeJSFontService] Successfully loaded font from: ${url}`);
            resolve(font);
          },
          (progress) => {
            console.log(`[ThreeJSFontService] Loading progress for ${url}:`, progress);
          },
          (error) => {
            console.error(`[ThreeJSFontService] Failed to load font from ${url}:`, error);
            reject(error);
          }
        );
      }).catch(reject);
    });
  }

  private async getFallbackFont(): Promise<Font | null> {
    if (this.fallbackFont) {
      return this.fallbackFont;
    }

    try {
      // Try to load the default Helvetiker font as fallback
      this.fallbackFont = await this.loadAndValidateFont(
        'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        'Helvetiker'
      );
      console.log('[ThreeJSFontService] Fallback font (Helvetiker) loaded');
      return this.fallbackFont;
    } catch (error) {
      console.error('[ThreeJSFontService] Fallback font loading failed:', error);
      return null;
    }
  }

  async loadFontForText(text: string): Promise<Font | null> {
    const fontName = this.getFontNameForText(text);
    return this.loadFont(fontName);
  }

  // Preload commonly used fonts including Devanagari
  async preloadFonts(fontNames: string[] = ['Helvetiker', 'Noto Sans Devanagari', 'Optimer']): Promise<void> {
    console.log('[ThreeJSFontService] Starting font preloading:', fontNames);
    const loadPromises = fontNames.map(name => this.loadFont(name));
    const results = await Promise.allSettled(loadPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[ThreeJSFontService] Failed to preload font: ${fontNames[index]}`, result.reason);
      } else {
        console.log(`[ThreeJSFontService] Successfully preloaded font: ${fontNames[index]}`);
      }
    });
    
    console.log('[ThreeJSFontService] Font preloading completed');
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getFontUrl(fontName: string): string {
    const fontInfo = this.fonts.get(fontName);
    const url = fontInfo?.url || 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';
    console.log(`[ThreeJSFontService] Getting URL for font ${fontName}: ${url}`);
    return url;
  }

  getFontUrlForText(text: string): string {
    const fontName = this.getFontNameForText(text);
    return this.getFontUrl(fontName);
  }

  testDevanagariSupport(text: string): { 
    scriptType: string; 
    fontName: string; 
    fontUrl: string;
    hasDevanagari: boolean;
    validationSupported: boolean;
  } {
    const scriptType = this.detectScriptType(text);
    const fontName = this.getFontNameForText(text);
    const fontUrl = this.getFontUrlForText(text);
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    
    return {
      scriptType,
      fontName,
      fontUrl,
      hasDevanagari,
      validationSupported: true
    };
  }
}

export const threejsFontService = new ThreeJSFontService();
