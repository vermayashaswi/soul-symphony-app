
interface FontConfig {
  name: string;
  url: string;
  scripts: string[];
  fallback?: string;
}

// Extend window interface to include THREE
declare global {
  interface Window {
    THREE?: any;
  }
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

  getFallbackFont(text: string): string {
    const config = this.getFontConfig(text);
    return config.fallback || 'Arial, sans-serif';
  }

  isComplexScript(text: string): boolean {
    const script = this.detectScript(text);
    return script !== 'latin';
  }

  // Always return false to force Canvas rendering
  canLoadFonts(): boolean {
    return false;
  }

  // Simplified method that always throws to force Canvas fallback
  async loadFont(text: string): Promise<any> {
    console.log('[EnhancedFontService] Forcing Canvas renderer for all text');
    throw new Error('Canvas renderer preferred');
  }
}

export const enhancedFontService = new EnhancedFontService();
