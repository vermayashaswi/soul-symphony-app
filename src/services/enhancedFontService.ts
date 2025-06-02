
interface FontConfig {
  name: string;
  url: string;
  scripts: string[];
  fallback?: string;
}

class EnhancedFontService {
  private fonts: FontConfig[] = [
    {
      name: 'Helvetiker',
      url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
      scripts: ['latin'],
      fallback: 'Arial, sans-serif'
    },
    {
      name: 'Noto Sans Devanagari',
      url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json',
      scripts: ['devanagari'],
      fallback: 'Noto Sans Devanagari, Arial, sans-serif'
    }
  ];

  private fontCache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();

  detectScript(text: string): string {
    if (!text) return 'latin';
    
    // Devanagari script detection (Hindi, Marathi, Sanskrit)
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    
    // Add more script detection as needed
    return 'latin';
  }

  getFontConfig(text: string): FontConfig {
    const script = this.detectScript(text);
    const font = this.fonts.find(f => f.scripts.includes(script));
    const fallbackFont = this.fonts.find(f => f.scripts.includes('latin'));
    
    return font || fallbackFont || this.fonts[0];
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

    // Start loading
    const loadingPromise = this.loadFontFromUrl(config.url);
    this.loadingPromises.set(config.url, loadingPromise);

    try {
      const font = await loadingPromise;
      this.fontCache.set(config.url, font);
      this.loadingPromises.delete(config.url);
      console.log(`[EnhancedFontService] Successfully loaded font: ${config.name}`);
      return font;
    } catch (error) {
      this.loadingPromises.delete(config.url);
      console.error(`[EnhancedFontService] Failed to load font: ${config.name}`, error);
      throw error;
    }
  }

  private async loadFontFromUrl(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const loader = new (window as any).THREE.FontLoader();
      loader.load(
        url,
        (font: any) => resolve(font),
        undefined,
        (error: any) => reject(error)
      );
    });
  }

  getFallbackFont(text: string): string {
    const config = this.getFontConfig(text);
    return config.fallback || 'Arial, sans-serif';
  }

  isComplexScript(text: string): boolean {
    const script = this.detectScript(text);
    return script !== 'latin';
  }
}

export const enhancedFontService = new EnhancedFontService();
