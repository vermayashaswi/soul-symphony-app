
class SimplifiedFontService {
  private fontUrl = '/fonts/helvetiker_regular.typeface.json';

  getFontUrl(): string {
    return this.fontUrl;
  }
}

export const simplifiedFontService = new SimplifiedFontService();
