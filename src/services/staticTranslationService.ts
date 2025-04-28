
// This file is mentioned but not provided in the allowed files list
// Let's create a basic static translation service with synchronous capability

import { translationCache } from './translationCache';

class StaticTranslationService {
  private language: string = 'en';
  private isBusy: boolean = false;
  
  // Common date-related terms for quick translation
  private static dateTerms: Record<string, Record<string, string>> = {
    'es': {
      'January': 'Enero',
      'February': 'Febrero', 
      'March': 'Marzo',
      'April': 'Abril',
      'May': 'Mayo',
      'June': 'Junio',
      'July': 'Julio',
      'August': 'Agosto',
      'September': 'Septiembre',
      'October': 'Octubre',
      'November': 'Noviembre',
      'December': 'Diciembre',
      'Monday': 'Lunes',
      'Tuesday': 'Martes',
      'Wednesday': 'Miércoles',
      'Thursday': 'Jueves',
      'Friday': 'Viernes',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo',
      'at': 'a las'
    },
    'fr': {
      'January': 'Janvier',
      'February': 'Février',
      'March': 'Mars',
      'April': 'Avril',
      'May': 'Mai',
      'June': 'Juin',
      'July': 'Juillet',
      'August': 'Août',
      'September': 'Septembre',
      'October': 'Octobre',
      'November': 'Novembre',
      'December': 'Décembre',
      'Monday': 'Lundi',
      'Tuesday': 'Mardi',
      'Wednesday': 'Mercredi',
      'Thursday': 'Jeudi',
      'Friday': 'Vendredi',
      'Saturday': 'Samedi',
      'Sunday': 'Dimanche',
      'at': 'à'
    },
    'de': {
      'January': 'Januar',
      'February': 'Februar',
      'March': 'März',
      'April': 'April',
      'May': 'Mai',
      'June': 'Juni',
      'July': 'Juli',
      'August': 'August',
      'September': 'September',
      'October': 'Oktober',
      'November': 'November',
      'December': 'Dezember',
      'Monday': 'Montag',
      'Tuesday': 'Dienstag',
      'Wednesday': 'Mittwoch',
      'Thursday': 'Donnerstag',
      'Friday': 'Freitag',
      'Saturday': 'Samstag',
      'Sunday': 'Sonntag',
      'at': 'um'
    }
    // Add more languages as needed
  };

  constructor() {
    // Initialize with the default language
    this.language = 'en';
  }

  public setLanguage(lang: string): void {
    this.language = lang;
  }

  public getLanguage(): string {
    return this.language;
  }

  // Asynchronous translation method (existing from your implementation)
  public async translateText(text: string, targetLang?: string): Promise<string> {
    if (!text || text.trim() === '') return '';
    
    const lang = targetLang || this.language;
    if (lang === 'en') return text;
    
    // Check cache first
    const cachedTranslation = translationCache.get(text, lang);
    if (cachedTranslation) {
      return cachedTranslation;
    }
    
    if (this.isBusy) {
      // If already translating, return original to avoid overwhelming the API
      return text;
    }
    
    try {
      this.isBusy = true;
      
      // In a real implementation, this would call an API
      // For now, we'll simulate a translation by returning the text with a language marker
      const translatedText = `[${lang}] ${text}`;
      
      // Cache the result
      translationCache.set(text, translatedText, lang);
      
      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    } finally {
      this.isBusy = false;
    }
  }

  // New synchronous method specifically for date translations
  public translateTextSync(text: string, targetLang?: string): string {
    if (!text || text.trim() === '') return '';
    
    const lang = targetLang || this.language;
    if (lang === 'en') return text;
    
    // Check cache first
    const cachedTranslation = translationCache.get(text, lang);
    if (cachedTranslation) {
      return cachedTranslation;
    }
    
    // For dates, we can do simple term replacements
    let result = text;
    const dateTerms = StaticTranslationService.dateTerms[lang];
    
    if (dateTerms) {
      // Replace each term in the text
      Object.entries(dateTerms).forEach(([engTerm, translation]) => {
        const regex = new RegExp(`\\b${engTerm}\\b`, 'g');
        result = result.replace(regex, translation);
      });
    }
    
    // Cache this result too
    translationCache.set(text, result, lang);
    
    return result;
  }
}

export const staticTranslationService = new StaticTranslationService();
