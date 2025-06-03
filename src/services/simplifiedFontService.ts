
interface FontConfig {
  name: string;
  scripts: string[];
  cssFont: string;
}

class SimplifiedFontService {
  private fonts: FontConfig[] = [
    {
      name: 'System Default',
      scripts: ['latin'],
      cssFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
    },
    {
      name: 'Devanagari Support',
      scripts: ['devanagari'],
      cssFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", "Noto Sans Hindi", Arial, sans-serif'
    }
  ];

  detectScript(text: string): string {
    if (!text) return 'latin';
    
    // Simple Devanagari detection
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
    
    return 'latin';
  }

  getCSSFont(text: string): string {
    const script = this.detectScript(text);
    
    const font = this.fonts.find(f => f.scripts.includes(script));
    const fallbackFont = this.fonts.find(f => f.scripts.includes('latin'));
    
    const cssFont = font?.cssFont || fallbackFont?.cssFont || this.fonts[0].cssFont;
    
    console.log(`[SimplifiedFontService] Text: "${text}" -> Script: ${script} -> CSS Font: ${cssFont}`);
    return cssFont;
  }

  // Legacy method for compatibility - now returns CSS font instead of URL
  getFontUrl(text: string): string {
    return this.getCSSFont(text);
  }
}

export const simplifiedFontService = new SimplifiedFontService();
