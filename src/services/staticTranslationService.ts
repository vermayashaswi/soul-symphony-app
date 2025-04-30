
// Create a new service that doesn't depend on the database
// This is used for demo purposes only

import { translationCache } from './translationCache';
import { toast } from 'sonner';

// Helper function to create simple realistic mock translations
const createMockTranslation = (text: string, language: string): string => {
  if (language === 'en' || !text) return text;
  
  // Create a map of common words for each language
  // This provides a more realistic translation experience than just adding a suffix
  const commonTranslations: Record<string, Record<string, string>> = {
    es: {
      'the': 'el', 'a': 'un', 'is': 'es', 'are': 'son', 'you': 'tú', 
      'welcome': 'bienvenido', 'hello': 'hola', 'goodbye': 'adiós',
      'journal': 'diario', 'entry': 'entrada', 'day': 'día',
      'new': 'nuevo', 'delete': 'eliminar', 'edit': 'editar',
      'your': 'tu', 'today': 'hoy', 'yesterday': 'ayer',
      'entries': 'entradas', 'emotions': 'emociones', 'mood': 'humor',
      'analysis': 'análisis', 'recording': 'grabación', 'save': 'guardar',
      'cancel': 'cancelar', 'search': 'buscar', 'settings': 'configuración',
      'insights': 'percepciones', 'connection': 'conexión', 'offline': 'desconectado',
      'online': 'en línea', 'slow': 'lento'
    },
    fr: {
      'the': 'le', 'a': 'un', 'is': 'est', 'are': 'sont', 'you': 'vous',
      'welcome': 'bienvenue', 'hello': 'bonjour', 'goodbye': 'au revoir',
      'journal': 'journal', 'entry': 'entrée', 'day': 'jour',
      'new': 'nouveau', 'delete': 'supprimer', 'edit': 'modifier',
      'your': 'votre', 'today': 'aujourd\'hui', 'yesterday': 'hier',
      'entries': 'entrées', 'emotions': 'émotions', 'mood': 'humeur',
      'analysis': 'analyse', 'recording': 'enregistrement', 'save': 'sauvegarder',
      'cancel': 'annuler', 'search': 'rechercher', 'settings': 'paramètres',
      'insights': 'aperçus', 'connection': 'connexion', 'offline': 'hors ligne',
      'online': 'en ligne', 'slow': 'lent'
    },
    de: {
      'the': 'die', 'a': 'ein', 'is': 'ist', 'are': 'sind', 'you': 'du',
      'welcome': 'willkommen', 'hello': 'hallo', 'goodbye': 'auf wiedersehen',
      'journal': 'tagebuch', 'entry': 'eintrag', 'day': 'tag',
      'new': 'neu', 'delete': 'löschen', 'edit': 'bearbeiten',
      'your': 'dein', 'today': 'heute', 'yesterday': 'gestern',
      'entries': 'einträge', 'emotions': 'emotionen', 'mood': 'stimmung',
      'analysis': 'analyse', 'recording': 'aufnahme', 'save': 'speichern',
      'cancel': 'abbrechen', 'search': 'suchen', 'settings': 'einstellungen',
      'insights': 'erkenntnisse', 'connection': 'verbindung', 'offline': 'offline',
      'online': 'online', 'slow': 'langsam'
    },
    zh: {
      'the': '的', 'a': '一个', 'is': '是', 'are': '是', 'you': '你',
      'welcome': '欢迎', 'hello': '你好', 'goodbye': '再见',
      'journal': '日记', 'entry': '条目', 'day': '天',
      'new': '新的', 'delete': '删除', 'edit': '编辑',
      'your': '你的', 'today': '今天', 'yesterday': '昨天',
      'entries': '条目', 'emotions': '情感', 'mood': '情绪',
      'analysis': '分析', 'recording': '录音', 'save': '保存',
      'cancel': '取消', 'search': '搜索', 'settings': '设置',
      'insights': '洞察', 'connection': '连接', 'offline': '离线',
      'online': '在线', 'slow': '慢的'
    },
    ja: {
      'the': 'その', 'a': '一つの', 'is': 'です', 'are': 'です', 'you': 'あなた',
      'welcome': 'ようこそ', 'hello': 'こんにちは', 'goodbye': 'さようなら',
      'journal': '日記', 'entry': 'エントリ', 'day': '日',
      'new': '新しい', 'delete': '削除', 'edit': '編集',
      'your': 'あなたの', 'today': '今日', 'yesterday': '昨日',
      'entries': 'エントリー', 'emotions': '感情', 'mood': '気分',
      'analysis': '分析', 'recording': '録音', 'save': '保存',
      'cancel': 'キャンセル', 'search': '検索', 'settings': '設定',
      'insights': '洞察', 'connection': '接続', 'offline': 'オフライン',
      'online': 'オンライン', 'slow': '遅い'
    },
    hi: {
      'the': 'वह', 'a': 'एक', 'is': 'है', 'are': 'हैं', 'you': 'आप',
      'welcome': 'स्वागत है', 'hello': 'नमस्ते', 'goodbye': 'अलविदा',
      'journal': 'पत्रिका', 'entry': 'प्रविष्टि', 'day': 'दिन',
      'new': 'नया', 'delete': 'हटाएं', 'edit': 'संपादित करें',
      'your': 'आपका', 'today': 'आज', 'yesterday': 'कल',
      'entries': 'प्रविष्टियां', 'emotions': 'भावनाएं', 'mood': 'मूड',
      'analysis': 'विश्लेषण', 'recording': 'रिकॉर्डिंग', 'save': 'सहेजें',
      'cancel': 'रद्द करें', 'search': 'खोज', 'settings': 'सेटिंग्स',
      'insights': 'अंतर्दृष्टि', 'connection': 'कनेक्शन', 'offline': 'ऑफलाइन',
      'online': 'ऑनलाइन', 'slow': 'धीमा'
    },
    ru: {
      'the': '', 'a': '', 'is': 'это', 'are': 'являются', 'you': 'вы',
      'welcome': 'добро пожаловать', 'hello': 'привет', 'goodbye': 'до свидания',
      'journal': 'журнал', 'entry': 'запись', 'day': 'день',
      'new': 'новый', 'delete': 'удалить', 'edit': 'редактировать',
      'your': 'ваш', 'today': 'сегодня', 'yesterday': 'вчера',
      'entries': 'записи', 'emotions': 'эмоции', 'mood': 'настроение',
      'analysis': 'анализ', 'recording': 'запись', 'save': 'сохранить',
      'cancel': 'отмена', 'search': 'поиск', 'settings': 'настройки',
      'insights': 'аналитика', 'connection': 'соединение', 'offline': 'не в сети',
      'online': 'в сети', 'slow': 'медленный'
    },
    ar: {
      'the': 'ال', 'a': 'أحد', 'is': 'هو', 'are': 'هم', 'you': 'أنت',
      'welcome': 'مرحبا', 'hello': 'مرحبا', 'goodbye': 'وداعا',
      'journal': 'مجلة', 'entry': 'إدخال', 'day': 'يوم',
      'new': 'جديد', 'delete': 'حذف', 'edit': 'تحرير',
      'your': 'لك', 'today': 'اليوم', 'yesterday': 'أمس',
      'entries': 'إدخالات', 'emotions': 'مشاعر', 'mood': 'مزاج',
      'analysis': 'تحليل', 'recording': 'تسجيل', 'save': 'حفظ',
      'cancel': 'إلغاء', 'search': 'بحث', 'settings': 'إعدادات',
      'insights': 'رؤى', 'connection': 'اتصال', 'offline': 'غير متصل',
      'online': 'متصل', 'slow': 'بطيء'
    },
    pt: {
      'the': 'o', 'a': 'um', 'is': 'é', 'are': 'são', 'you': 'você',
      'welcome': 'bem-vindo', 'hello': 'olá', 'goodbye': 'adeus',
      'journal': 'diário', 'entry': 'entrada', 'day': 'dia',
      'new': 'novo', 'delete': 'excluir', 'edit': 'editar',
      'your': 'seu', 'today': 'hoje', 'yesterday': 'ontem',
      'entries': 'entradas', 'emotions': 'emoções', 'mood': 'humor',
      'analysis': 'análise', 'recording': 'gravação', 'save': 'salvar',
      'cancel': 'cancelar', 'search': 'buscar', 'settings': 'configurações',
      'insights': 'insights', 'connection': 'conexão', 'offline': 'offline',
      'online': 'online', 'slow': 'lento'
    }
  };
  
  // If we don't have translations for this language, return original text
  if (!commonTranslations[language]) {
    return text;
  }
  
  // Split the text into words
  const words = text.split(/\b/);
  
  // Replace common words with translations
  const translatedWords = words.map(word => {
    const lowerWord = word.toLowerCase();
    return commonTranslations[language][lowerWord] || word;
  });
  
  return translatedWords.join('');
};

// A basic static translation service that uses mock translations
class StaticTranslationService {
  private language: string = 'en';
  private mockTranslationDelay: number = 200; // 200ms delay to simulate API call
  private pendingTranslations: Map<string, Promise<string>> = new Map();
  
  // Change the language
  setLanguage(lang: string): void {
    if (this.language !== lang) {
      console.log(`StaticTranslationService: Changing language to ${lang}`);
      this.language = lang;
      // Clear pending translations when language changes
      this.pendingTranslations.clear();
    }
  }
  
  // Get current language
  getLanguage(): string {
    return this.language;
  }

  // A function that translates text
  async translateText(
    text: string, 
    sourceLanguage: string = 'en', 
    entryId?: number
  ): Promise<string> {
    if (!text || !text.trim() || this.language === 'en') {
      return text;
    }
    
    // Create a unique key for this translation request
    const translationKey = `${text}__${this.language}__${entryId || ''}`;
    
    // Check if this translation is already in progress
    if (this.pendingTranslations.has(translationKey)) {
      return this.pendingTranslations.get(translationKey)!;
    }
    
    // Create a new translation promise
    const translationPromise = (async () => {
      try {
        // Check cache first
        const cached = await translationCache.getTranslation(text, this.language);
        if (cached) {
          return cached.translatedText;
        }
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.mockTranslationDelay));
        
        // Use our improved mock translation function
        const translatedText = createMockTranslation(text, this.language);
        
        // Cache the result
        await translationCache.setTranslation({
          originalText: text,
          translatedText: translatedText,
          language: this.language,
          timestamp: Date.now(),
          version: 1
        });
        
        return translatedText;
      } catch (error) {
        console.error("Static translation error:", error);
        return text;
      } finally {
        // Remove from pending translations when complete
        this.pendingTranslations.delete(translationKey);
      }
    })();
    
    // Store the promise so we can return it for duplicate requests
    this.pendingTranslations.set(translationKey, translationPromise);
    
    return translationPromise;
  }
  
  // Pre-translate multiple texts - used for batch operations
  async preTranslate(
    texts: string[],
    sourceLanguage: string = 'en'
  ): Promise<Map<string, string>> {
    return this.batchTranslateTexts(texts, sourceLanguage);
  }
  
  // Batch translate multiple texts at once
  async batchTranslateTexts(
    texts: string[],
    sourceLanguage: string = 'en'
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (!texts || texts.length === 0 || this.language === 'en') {
      // Return the original texts as-is for English
      texts.forEach(text => results.set(text, text));
      return results;
    }
    
    // Check cache and filter out texts that need translation
    const uncachedTexts: string[] = [];
    
    await Promise.all(
      texts.map(async (text) => {
        if (!text || !text.trim()) {
          results.set(text, text);
          return;
        }
        
        const cached = await translationCache.getTranslation(text, this.language);
        if (cached) {
          results.set(text, cached.translatedText);
        } else {
          uncachedTexts.push(text);
        }
      })
    );
    
    // Translate uncached texts
    if (uncachedTexts.length > 0) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, this.mockTranslationDelay));
      
      // Translate each text
      for (const text of uncachedTexts) {
        const translatedText = createMockTranslation(text, this.language);
        results.set(text, translatedText);
        
        // Cache the result
        await translationCache.setTranslation({
          originalText: text,
          translatedText: translatedText,
          language: this.language,
          timestamp: Date.now(),
          version: 1
        });
      }
    }
    
    return results;
  }
}

// Export a singleton
export const staticTranslationService = new StaticTranslationService();
