
interface FontConfig {
  name: string;
  url: string;
  scripts: string[];
}

class SimplifiedFontService {
  private fonts: FontConfig[] = [
    {
      name: 'Helvetiker',
      url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
      scripts: ['latin']
    }
    // Removed problematic Devanagari font - fallback to Latin font for all scripts
    // {
    //   name: 'Noto Sans Devanagari',
    //   url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json',
    //   scripts: ['devanagari']
    // }
  ];

  detectScript(text: string): string {
    if (!text) return 'latin';
    
    // Simple Devanagari detection
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    
    return 'latin';
  }

  getFontUrl(text: string): string {
    const script = this.detectScript(text);
    
    // Always use Latin font as fallback for now since other fonts are problematic
    const font = this.fonts.find(f => f.scripts.includes('latin'));
    
    const url = font?.url || this.fonts[0]?.url;
    
    console.log(`[SimplifiedFontService] Text: "${text}" -> Script: ${script} -> Using Latin font: ${url}`);
    return url;
  }
}

export const simplifiedFontService = new SimplifiedFontService();
