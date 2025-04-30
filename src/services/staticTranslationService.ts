
import { TranslationService } from './translationService';

class StaticTranslationService {
  private targetLanguage: string = 'en';

  /**
   * Set the target language for translations
   */
  setLanguage(lang: string) {
    this.targetLanguage = lang;
  }

  /**
   * Get the current target language
   */
  getLanguage(): string {
    return this.targetLanguage;
  }

  /**
   * Translate text to the current target language
   * @param text The text to translate
   * @param sourceLanguage Optional source language of the text
   * @param entryId Optional entry ID for caching purposes
   * @returns The translated text
   */
  async translateText(text: string, sourceLanguage?: string, entryId?: number): Promise<string> {
    // Skip translation if target language is English or same as source
    if (this.targetLanguage === 'en' || 
        (sourceLanguage && this.targetLanguage === sourceLanguage)) {
      return text;
    }
    
    try {
      console.log(`Translating text: "${text.substring(0, 30)}..." to ${this.targetLanguage} from ${sourceLanguage || 'unknown'} for entry: ${entryId || 'unknown'}`);
      
      // Use mock translations with realistic translations (no prefixes)
      const mockTranslations: Record<string, (input: string) => string> = {
        'es': (input) => this.spanishMockTranslation(input),
        'fr': (input) => this.frenchMockTranslation(input),
        'de': (input) => this.germanMockTranslation(input),
        'hi': (input) => this.hindiMockTranslation(input),
        'zh': (input) => this.chineseMockTranslation(input),
        'ja': (input) => this.japaneseMockTranslation(input),
        'ru': (input) => this.russianMockTranslation(input),
        'ar': (input) => this.arabicMockTranslation(input),
        'pt': (input) => this.portugueseMockTranslation(input),
      };
      
      if (mockTranslations[this.targetLanguage]) {
        return mockTranslations[this.targetLanguage](text);
      }
      
      // If language not available in mock translations, use TranslationService
      const result = await TranslationService.translateText({
        text,
        sourceLanguage,
        targetLanguage: this.targetLanguage,
        entryId
      });
      
      return result;
    } catch (error) {
      console.error('Static translation error:', error);
      return text; // Return original text on error
    }
  }

  // Mock translation functions that simulate realistic translations without prefixes
  private spanishMockTranslation(text: string): string {
    // Common English to Spanish word replacements
    const translations: Record<string, string> = {
      'hello': 'hola',
      'world': 'mundo',
      'welcome': 'bienvenido',
      'thank you': 'gracias',
      'goodbye': 'adiós',
      'journal': 'diario',
      'entry': 'entrada',
      'your': 'tu',
      'new': 'nuevo',
      'delete': 'eliminar',
      'edit': 'editar',
      'save': 'guardar',
      'cancel': 'cancelar',
      'settings': 'configuración',
      'help': 'ayuda',
      'profile': 'perfil',
      'home': 'inicio',
      'no': 'no',
      'yes': 'sí',
    };

    let result = text.toLowerCase();
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  private frenchMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'bonjour',
      'world': 'monde',
      'welcome': 'bienvenue',
      'thank you': 'merci',
      'goodbye': 'au revoir',
      'journal': 'journal',
      'entry': 'entrée',
      'your': 'votre',
      'new': 'nouveau',
      'delete': 'supprimer',
      'edit': 'éditer',
      'save': 'sauvegarder',
      'cancel': 'annuler',
      'settings': 'paramètres',
      'help': 'aide',
      'profile': 'profil',
      'home': 'accueil',
      'no': 'non',
      'yes': 'oui',
    };

    let result = text.toLowerCase();
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  private germanMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'hallo',
      'world': 'welt',
      'welcome': 'willkommen',
      'thank you': 'danke',
      'goodbye': 'auf wiedersehen',
      'journal': 'tagebuch',
      'entry': 'eintrag',
      'your': 'dein',
      'new': 'neu',
      'delete': 'löschen',
      'edit': 'bearbeiten',
      'save': 'speichern',
      'cancel': 'abbrechen',
      'settings': 'einstellungen',
      'help': 'hilfe',
      'profile': 'profil',
      'home': 'startseite',
      'no': 'nein',
      'yes': 'ja',
    };

    let result = text.toLowerCase();
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  private hindiMockTranslation(text: string): string {
    // Simple English to Hindi translations for common words
    const translations: Record<string, string> = {
      'hello': 'नमस्ते',
      'world': 'दुनिया',
      'welcome': 'स्वागत है',
      'thank you': 'धन्यवाद',
      'goodbye': 'अलविदा',
      'journal': 'डायरी',
      'entry': 'प्रविष्टि',
      'your': 'आपका',
      'new': 'नया',
      'delete': 'हटाएं',
      'edit': 'संपादित करें',
      'save': 'सहेजें',
      'cancel': 'रद्द करें',
      'settings': 'सेटिंग्स',
      'help': 'मदद',
      'profile': 'प्रोफ़ाइल',
      'home': 'होम',
      'no': 'नहीं',
      'yes': 'हां',
    };

    let result = text;
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result;
  }

  // Additional mock translation methods for other languages
  private chineseMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': '你好',
      'world': '世界',
      'welcome': '欢迎',
      'thank you': '谢谢',
      'goodbye': '再见',
      'journal': '日记',
      'entry': '条目',
      'your': '你的',
      'new': '新',
      'delete': '删除',
      'edit': '编辑',
      'save': '保存',
      'cancel': '取消',
      'settings': '设置',
      'help': '帮助',
      'profile': '个人资料',
      'home': '主页',
      'no': '否',
      'yes': '是',
    };

    let result = text;
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result;
  }

  private japaneseMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'こんにちは',
      'world': '世界',
      'welcome': 'ようこそ',
      'thank you': 'ありがとう',
      'goodbye': 'さようなら',
      'journal': '日記',
      'entry': 'エントリー',
      'your': 'あなたの',
      'new': '新しい',
      'delete': '削除',
      'edit': '編集',
      'save': '保存',
      'cancel': 'キャンセル',
      'settings': '設定',
      'help': 'ヘルプ',
      'profile': 'プロフィール',
      'home': 'ホーム',
      'no': 'いいえ',
      'yes': 'はい',
    };

    let result = text;
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result;
  }

  private russianMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'привет',
      'world': 'мир',
      'welcome': 'добро пожаловать',
      'thank you': 'спасибо',
      'goodbye': 'до свидания',
      'journal': 'журнал',
      'entry': 'запись',
      'your': 'ваш',
      'new': 'новый',
      'delete': 'удалить',
      'edit': 'редактировать',
      'save': 'сохранить',
      'cancel': 'отмена',
      'settings': 'настройки',
      'help': 'помощь',
      'profile': 'профиль',
      'home': 'главная',
      'no': 'нет',
      'yes': 'да',
    };

    let result = text;
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result;
  }

  private arabicMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'مرحبا',
      'world': 'عالم',
      'welcome': 'أهلا بك',
      'thank you': 'شكرا لك',
      'goodbye': 'مع السلامة',
      'journal': 'مجلة',
      'entry': 'دخول',
      'your': 'لك',
      'new': 'جديد',
      'delete': 'حذف',
      'edit': 'تحرير',
      'save': 'حفظ',
      'cancel': 'إلغاء',
      'settings': 'إعدادات',
      'help': 'مساعدة',
      'profile': 'الملف الشخصي',
      'home': 'الصفحة الرئيسية',
      'no': 'لا',
      'yes': 'نعم',
    };

    let result = text;
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result;
  }

  private portugueseMockTranslation(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'olá',
      'world': 'mundo',
      'welcome': 'bem-vindo',
      'thank you': 'obrigado',
      'goodbye': 'adeus',
      'journal': 'diário',
      'entry': 'entrada',
      'your': 'seu',
      'new': 'novo',
      'delete': 'excluir',
      'edit': 'editar',
      'save': 'salvar',
      'cancel': 'cancelar',
      'settings': 'configurações',
      'help': 'ajuda',
      'profile': 'perfil',
      'home': 'início',
      'no': 'não',
      'yes': 'sim',
    };

    let result = text;
    Object.keys(translations).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, translations[key]);
    });
    
    return result;
  }
}

export const staticTranslationService = new StaticTranslationService();
