
interface LocalFontConfig {
  name: string;
  localPath: string;
  fallbackUrl: string;
  scriptSupport: string[];
}

class LocalFontService {
  private fonts: Map<string, LocalFontConfig> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeFonts();
  }

  private initializeFonts() {
    const fontConfigs: LocalFontConfig[] = [
      {
        name: 'Helvetiker',
        localPath: '/fonts/helvetiker_regular.typeface.json',
        fallbackUrl: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        scriptSupport: ['latin']
      },
      {
        name: 'Noto Sans Devanagari',
        localPath: '/fonts/noto_sans_devanagari_regular.typeface.json',
        fallbackUrl: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json',
        scriptSupport: ['devanagari']
      },
      {
        name: 'Optimer',
        localPath: '/fonts/optimer_regular.typeface.json',
        fallbackUrl: 'https://threejs.org/examples/fonts/optimer_regular.typeface.json',
        scriptSupport: ['latin', 'arabic', 'chinese', 'japanese', 'korean']
      }
    ];

    fontConfigs.forEach(config => {
      this.fonts.set(config.name, config);
    });

    this.isInitialized = true;
    console.log('[LocalFontService] Initialized with', this.fonts.size, 'fonts');
  }

  detectScriptType(text: string): string {
    if (!text) return 'latin';
    
    // Enhanced script detection
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
        return 'Noto Sans Devanagari';
      case 'arabic':
      case 'chinese':
      case 'japanese':
      case 'korean':
        return 'Optimer';
      default:
        return 'Helvetiker';
    }
  }

  getFontNameForText(text: string): string {
    const scriptType = this.detectScriptType(text);
    const fontName = this.getFontNameForScript(scriptType);
    
    console.log(`[LocalFontService] Text: "${text}" -> Script: ${scriptType} -> Font: ${fontName}`);
    return fontName;
  }

  getFontUrl(fontName: string, preferLocal: boolean = true): string {
    const fontConfig = this.fonts.get(fontName);
    
    if (!fontConfig) {
      console.warn(`[LocalFontService] Font not found: ${fontName}, using Helvetiker`);
      return this.getFontUrl('Helvetiker', preferLocal);
    }

    // Return local path if preferred and available
    if (preferLocal) {
      console.log(`[LocalFontService] Using local font: ${fontConfig.localPath}`);
      return fontConfig.localPath;
    }

    console.log(`[LocalFontService] Using fallback font: ${fontConfig.fallbackUrl}`);
    return fontConfig.fallbackUrl;
  }

  getFontUrlForText(text: string, preferLocal: boolean = true): string {
    const fontName = this.getFontNameForText(text);
    return this.getFontUrl(fontName, preferLocal);
  }

  getFallbackUrl(fontName: string): string {
    const fontConfig = this.fonts.get(fontName);
    return fontConfig?.fallbackUrl || this.getFontUrl('Helvetiker', false);
  }

  // Test method for Devanagari support
  testDevanagariSupport(text: string): { 
    scriptType: string; 
    fontName: string; 
    localUrl: string;
    fallbackUrl: string;
    hasDevanagari: boolean;
  } {
    const scriptType = this.detectScriptType(text);
    const fontName = this.getFontNameForText(text);
    const localUrl = this.getFontUrl(fontName, true);
    const fallbackUrl = this.getFallbackUrl(fontName);
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    
    return {
      scriptType,
      fontName,
      localUrl,
      fallbackUrl,
      hasDevanagari
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const localFontService = new LocalFontService();
