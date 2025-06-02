
interface LocalFontConfig {
  name: string;
  localPath: string;
  fallbackUrl: string;
  scriptSupport: string[];
}

interface FontValidationResult {
  isValid: boolean;
  hasGlyphs: boolean;
  glyphCount: number;
  supportsScript: boolean;
  issues: string[];
}

class LocalFontService {
  private fonts: Map<string, LocalFontConfig> = new Map();
  private isInitialized = false;
  private validatedFonts: Map<string, FontValidationResult> = new Map();

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

  // Enhanced font validation with glyph checking
  async validateFont(fontData: any, fontName: string, text?: string): Promise<FontValidationResult> {
    const result: FontValidationResult = {
      isValid: false,
      hasGlyphs: false,
      glyphCount: 0,
      supportsScript: false,
      issues: []
    };

    try {
      console.log(`[LocalFontService] Validating font: ${fontName}`);

      // Check if font data exists and has basic structure
      if (!fontData) {
        result.issues.push('Font data is null or undefined');
        return result;
      }

      if (typeof fontData !== 'object') {
        result.issues.push('Font data is not an object');
        return result;
      }

      // Check for required properties
      if (!fontData.glyphs) {
        result.issues.push('Font data missing glyphs property');
        return result;
      }

      // Check if glyphs is an object and not empty
      if (typeof fontData.glyphs !== 'object' || fontData.glyphs === null) {
        result.issues.push('Glyphs property is not an object');
        return result;
      }

      const glyphKeys = Object.keys(fontData.glyphs);
      result.glyphCount = glyphKeys.length;
      result.hasGlyphs = glyphKeys.length > 0;

      if (!result.hasGlyphs) {
        result.issues.push('Font has no glyphs defined');
        return result;
      }

      console.log(`[LocalFontService] Font ${fontName} has ${result.glyphCount} glyphs`);

      // If text is provided, check script support
      if (text) {
        const scriptType = this.detectScriptType(text);
        result.supportsScript = this.checkScriptSupport(fontData.glyphs, scriptType);
        
        if (!result.supportsScript) {
          result.issues.push(`Font does not support ${scriptType} script`);
        }
      } else {
        result.supportsScript = true; // Assume supported if no text to check
      }

      // Check for basic font metadata
      if (!fontData.familyName) {
        result.issues.push('Missing familyName');
      }

      // Font is valid if it has glyphs and supports the required script (if specified)
      result.isValid = result.hasGlyphs && (text ? result.supportsScript : true);

      console.log(`[LocalFontService] Font validation result for ${fontName}:`, result);
      
      // Cache the validation result
      this.validatedFonts.set(fontName, result);

      return result;
    } catch (error) {
      console.error(`[LocalFontService] Font validation error for ${fontName}:`, error);
      result.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private checkScriptSupport(glyphs: any, scriptType: string): boolean {
    const glyphKeys = Object.keys(glyphs);
    
    switch (scriptType) {
      case 'devanagari':
        // Check for common Devanagari characters
        return glyphKeys.some(key => /[\u0900-\u097F]/.test(key));
      case 'arabic':
        return glyphKeys.some(key => /[\u0600-\u06FF]/.test(key));
      case 'chinese':
        return glyphKeys.some(key => /[\u4E00-\u9FFF]/.test(key));
      case 'japanese':
        return glyphKeys.some(key => /[\u3040-\u309F\u30A0-\u30FF]/.test(key));
      case 'korean':
        return glyphKeys.some(key => /[\uAC00-\uD7AF]/.test(key));
      case 'latin':
      default:
        // Check for basic Latin characters
        return glyphKeys.some(key => /[a-zA-Z]/.test(key));
    }
  }

  // Get cached validation result
  getValidationResult(fontName: string): FontValidationResult | null {
    return this.validatedFonts.get(fontName) || null;
  }

  // Test method for Devanagari support with enhanced validation
  testDevanagariSupport(text: string): { 
    scriptType: string; 
    fontName: string; 
    localUrl: string;
    fallbackUrl: string;
    hasDevanagari: boolean;
    validationResult?: FontValidationResult;
  } {
    const scriptType = this.detectScriptType(text);
    const fontName = this.getFontNameForText(text);
    const localUrl = this.getFontUrl(fontName, true);
    const fallbackUrl = this.getFallbackUrl(fontName);
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const validationResult = this.getValidationResult(fontName);
    
    return {
      scriptType,
      fontName,
      localUrl,
      fallbackUrl,
      hasDevanagari,
      validationResult
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const localFontService = new LocalFontService();
