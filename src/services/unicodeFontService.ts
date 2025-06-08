
interface UnicodeFont {
  name: string;
  url: string;
  scripts: string[];
  ranges: [number, number][];
}

class UnicodeFontService {
  private fonts: UnicodeFont[] = [
    {
      name: 'Helvetiker',
      url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
      scripts: ['latin'],
      ranges: [[0x0000, 0x007F], [0x0080, 0x00FF]]
    },
    {
      name: 'Noto Sans Devanagari',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json',
      scripts: ['devanagari'],
      ranges: [[0x0900, 0x097F]]
    }
  ];

  private fontCache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();

  // Unicode-safe script detection
  detectScript(text: string): string {
    if (!text || typeof text !== 'string') return 'latin';
    
    // Convert to array of code points to handle surrogate pairs correctly
    const codePoints = Array.from(text).map(char => char.codePointAt(0) || 0);
    
    // Check for Devanagari script (Hindi, Marathi, Sanskrit)
    if (codePoints.some(cp => cp >= 0x0900 && cp <= 0x097F)) {
      return 'devanagari';
    }
    
    return 'latin';
  }

  getFontConfig(text: string): UnicodeFont {
    const script = this.detectScript(text);
    const font = this.fonts.find(f => f.scripts.includes(script));
    const fallbackFont = this.fonts.find(f => f.scripts.includes('latin'));
    
    const selectedFont = font || fallbackFont || this.fonts[0];
    console.log(`[UnicodeFontService] Text: "${text}" -> Script: ${script} -> Font: ${selectedFont.name}`);
    return selectedFont;
  }

  async loadFont(text: string): Promise<any> {
    const config = this.getFontConfig(text);
    
    // Check cache first
    if (this.fontCache.has(config.url)) {
      return this.fontCache.get(config.url);
    }

    // Check if already loading
    if (this.loadingPromises.has(config.url)) {
      return this.loadingPromises.get(config.url);
    }

    // Start loading with robust error handling
    const loadingPromise = this.loadFontFromUrl(config.url, config.name);
    this.loadingPromises.set(config.url, loadingPromise);

    try {
      const font = await loadingPromise;
      this.fontCache.set(config.url, font);
      this.loadingPromises.delete(config.url);
      console.log(`[UnicodeFontService] Successfully loaded font: ${config.name}`);
      return font;
    } catch (error) {
      this.loadingPromises.delete(config.url);
      console.error(`[UnicodeFontService] Failed to load font: ${config.name}`, error);
      
      // Fallback to Helvetiker if available
      if (config.name !== 'Helvetiker') {
        console.log(`[UnicodeFontService] Falling back to Helvetiker for: ${config.name}`);
        return this.loadFont('latin-fallback');
      }
      
      throw error;
    }
  }

  private async loadFontFromUrl(url: string, fontName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !(window as any).THREE) {
        reject(new Error('THREE.js FontLoader not available'));
        return;
      }

      const loader = new (window as any).THREE.FontLoader();
      
      // Set timeout for font loading
      const timeout = setTimeout(() => {
        reject(new Error(`Font loading timeout for ${fontName}`));
      }, 10000);
      
      loader.load(
        url,
        (font: any) => {
          clearTimeout(timeout);
          resolve(font);
        },
        undefined,
        (error: any) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to load font ${fontName}: ${error.message || 'Unknown error'}`));
        }
      );
    });
  }

  isComplexScript(text: string): boolean {
    const script = this.detectScript(text);
    return script !== 'latin';
  }

  // Get CSS fallback fonts for web rendering
  getFallbackFont(text: string): string {
    const script = this.detectScript(text);
    
    switch (script) {
      case 'devanagari':
        return 'Noto Sans Devanagari, Mangal, Devanagari Sangam MN, Arial Unicode MS, sans-serif';
      default:
        return 'Helvetica, Arial, sans-serif';
    }
  }
}

export const unicodeFontService = new UnicodeFontService();
