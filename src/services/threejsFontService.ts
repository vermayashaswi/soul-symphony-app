
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';

interface FontInfo {
  name: string;
  url: string;
  font?: Font;
  loading?: Promise<Font>;
  error?: Error;
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
        url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json'
      },
      {
        name: 'Helvetiker',
        url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json'
      },
      {
        name: 'Gentilis',
        url: 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json'
      },
      {
        name: 'Optimer',
        url: 'https://threejs.org/examples/fonts/optimer_regular.typeface.json'
      }
    ];

    fontConfigs.forEach(config => {
      this.fonts.set(config.name, config);
    });

    this.isInitialized = true;
  }

  detectScriptType(text: string): string {
    if (!text) return 'latin';
    
    // Enhanced script detection with proper Unicode ranges
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'arabic';
    if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'chinese';
    if (/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/.test(text)) return 'japanese';
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) return 'korean';
    
    return 'latin';
  }

  getFontNameForScript(scriptType: string): string {
    switch (scriptType) {
      case 'devanagari':
        return 'Noto Sans Devanagari'; // Use proper Devanagari font
      case 'arabic':
      case 'chinese':
      case 'japanese':
      case 'korean':
        return 'Optimer'; // Use Optimer for other scripts (fallback)
      default:
        return 'Helvetiker'; // Default Latin font
    }
  }

  getFontNameForText(text: string): string {
    const scriptType = this.detectScriptType(text);
    const fontName = this.getFontNameForScript(scriptType);
    console.log(`[ThreeJSFontService] Text: "${text}" -> Script: ${scriptType} -> Font: ${fontName}`);
    return fontName;
  }

  async loadFont(fontName: string): Promise<Font | null> {
    const fontInfo = this.fonts.get(fontName);
    if (!fontInfo) {
      console.warn(`[ThreeJSFontService] Font not found: ${fontName}, using fallback`);
      return this.getFallbackFont();
    }

    // Return cached font if available
    if (fontInfo.font) {
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
    fontInfo.loading = this.loadFontFromUrl(fontInfo.url);
    
    try {
      const font = await fontInfo.loading;
      fontInfo.font = font;
      delete fontInfo.loading;
      console.log(`[ThreeJSFontService] Font loaded successfully: ${fontName}`);
      return font;
    } catch (error) {
      fontInfo.error = error instanceof Error ? error : new Error('Unknown font loading error');
      delete fontInfo.loading;
      console.error(`[ThreeJSFontService] Font loading failed: ${fontName}, using fallback`, error);
      return this.getFallbackFont();
    }
  }

  private async loadFontFromUrl(url: string): Promise<Font> {
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
      this.fallbackFont = await this.loadFontFromUrl(
        'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json'
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

  // Get font URL for useLoader hook
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

  // Test method to verify Devanagari detection and font mapping
  testDevanagariSupport(text: string): { 
    scriptType: string; 
    fontName: string; 
    fontUrl: string;
    hasDevanagari: boolean;
  } {
    const scriptType = this.detectScriptType(text);
    const fontName = this.getFontNameForText(text);
    const fontUrl = this.getFontUrlForText(text);
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    
    return {
      scriptType,
      fontName,
      fontUrl,
      hasDevanagari
    };
  }
}

export const threejsFontService = new ThreeJSFontService();
