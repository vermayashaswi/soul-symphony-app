
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
  private isThreeJsAvailable = false;

  constructor() {
    // Check if THREE.js is available safely
    this.checkThreeJsAvailability();
  }

  private checkThreeJsAvailability(): void {
    try {
      this.isThreeJsAvailable = typeof window !== 'undefined' && 
                               window.THREE !== undefined && 
                               window.THREE.FontLoader !== undefined;
      console.log(`[EnhancedFontService] THREE.js availability:`, this.isThreeJsAvailable);
    } catch (error) {
      console.warn('[EnhancedFontService] Error checking THREE.js availability:', error);
      this.isThreeJsAvailable = false;
    }
  }

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
    // If THREE.js is not available, reject immediately to force Canvas fallback
    if (!this.isThreeJsAvailable) {
      console.log('[EnhancedFontService] THREE.js not available, forcing Canvas fallback');
      throw new Error('THREE.js FontLoader not available');
    }

    const config = this.getFontConfig(text);
    
    // Check cache first
    if (this.fontCache.has(config.url)) {
      console.log(`[EnhancedFontService] Font found in cache: ${config.name}`);
      return this.fontCache.get(config.url);
    }

    // Check if already loading
    if (this.loadingPromises.has(config.url)) {
      console.log(`[EnhancedFontService] Font already loading: ${config.name}`);
      return this.loadingPromises.get(config.url);
    }

    // Start loading with timeout
    const loadingPromise = this.loadFontFromUrlWithTimeout(config.url, 5000);
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

  private async loadFontFromUrlWithTimeout(url: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Font loading timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        if (!window.THREE || !window.THREE.FontLoader) {
          clearTimeout(timeout);
          reject(new Error('THREE.FontLoader not available'));
          return;
        }

        const loader = new window.THREE.FontLoader();
        loader.load(
          url,
          (font: any) => {
            clearTimeout(timeout);
            resolve(font);
          },
          undefined,
          (error: any) => {
            clearTimeout(timeout);
            reject(error);
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
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

  // Safe method to check if font loading is possible
  canLoadFonts(): boolean {
    return this.isThreeJsAvailable;
  }
}

export const enhancedFontService = new EnhancedFontService();
