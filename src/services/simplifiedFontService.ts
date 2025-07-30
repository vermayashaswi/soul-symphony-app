
interface FontConfig {
  name: string;
  url: string;
  scripts: string[];
}

class SimplifiedFontService {
  private readonly helvetikerUrl = 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';

  getFontUrl(text: string): string {
    // Always use Helvetiker font for all text (including Hindi/Devanagari)
    // Helvetiker supports Unicode and can render Hindi characters
    console.log(`[SimplifiedFontService] Using Helvetiker font for text: "${text}"`);
    return this.helvetikerUrl;
  }
}

export const simplifiedFontService = new SimplifiedFontService();
