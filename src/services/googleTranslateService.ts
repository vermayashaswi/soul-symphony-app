
export interface GoogleTranslateService {
  translateText: (text: string, sourceLanguage: string, targetLanguage: string) => Promise<string>;
}

class GoogleTranslateServiceImpl implements GoogleTranslateService {
  private apiKey: string | null = null;

  constructor() {
    // Try to get API key from environment or localStorage
    this.apiKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY || localStorage.getItem('google_translate_api_key');
  }

  async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    if (!this.apiKey) {
      console.warn('Google Translate API key not found');
      return text;
    }

    if (sourceLanguage === targetLanguage) {
      return text;
    }

    try {
      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage,
          target: targetLanguage,
          format: 'text'
        })
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.translations[0].translatedText || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }
}

export const googleTranslateService = new GoogleTranslateServiceImpl();
