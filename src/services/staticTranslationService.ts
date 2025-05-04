
// Static translation service for quick access to common translations

type TranslationMap = {
  [key: string]: {
    [language: string]: string;
  };
};

// Static translations map
const translations: TranslationMap = {
  // Common UI elements
  'common.save': {
    en: 'Save',
    es: 'Guardar',
    fr: 'Enregistrer',
    de: 'Speichern',
    zh: '保存',
    ja: '保存',
    ru: 'Сохранить',
    ar: 'حفظ',
    hi: 'सहेजें',
    pt: 'Salvar'
  },
  'common.cancel': {
    en: 'Cancel',
    es: 'Cancelar',
    fr: 'Annuler',
    de: 'Abbrechen',
    zh: '取消',
    ja: 'キャンセル',
    ru: 'Отмена',
    ar: 'إلغاء',
    hi: 'रद्द करें',
    pt: 'Cancelar'
  },
  'common.delete': {
    en: 'Delete',
    es: 'Eliminar',
    fr: 'Supprimer',
    de: 'Löschen',
    zh: '删除',
    ja: '削除',
    ru: 'Удалить',
    ar: 'حذف',
    hi: 'हटाएं',
    pt: 'Excluir'
  },
  'common.edit': {
    en: 'Edit',
    es: 'Editar',
    fr: 'Modifier',
    de: 'Bearbeiten',
    zh: '编辑',
    ja: '編集',
    ru: 'Редактировать',
    ar: 'تحرير',
    hi: 'संपादित करें',
    pt: 'Editar'
  },
  // Error messages
  'error.generic': {
    en: 'Something went wrong. Please try again.',
    es: 'Algo salió mal. Por favor, inténtalo de nuevo.',
    fr: 'Quelque chose s\'est mal passé. Veuillez réessayer.',
    de: 'Etwas ist schief gelaufen. Bitte versuche es erneut.',
    zh: '出错了，请重试。',
    ja: '問題が発生しました。もう一度お試しください。',
    ru: 'Что-то пошло не так. Пожалуйста, попробуйте еще раз.',
    ar: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    hi: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
    pt: 'Algo deu errado. Por favor, tente novamente.'
  }
};

// Static translation service
export const staticTranslation = {
  get(key: string, language: string): string | undefined {
    const translationObj = translations[key];
    if (!translationObj) return undefined;
    
    // Return the translation for the requested language or fall back to English
    return translationObj[language] || translationObj['en'];
  },
  
  // Add a new translation
  add(key: string, translations: { [language: string]: string }): void {
    if (!key) return;
    
    // Create or update the translation entry
    const existingTranslations = this.getAll(key) || {};
    
    // Merge with existing translations
    Object.keys(translations).forEach(lang => {
      existingTranslations[lang] = translations[lang];
    });
  },
  
  // Get all translations for a key
  getAll(key: string): { [language: string]: string } | undefined {
    return translations[key];
  },

  // Translate a text using Google Translate API
  async translateText(text: string, targetLanguage: string = 'en'): Promise<string> {
    if (!text || text.trim() === '') return '';
    
    try {
      // Mock translation for now (would normally call an API)
      console.log(`Translating text to ${targetLanguage}: ${text.substring(0, 30)}...`);
      return text; // In a real implementation, this would return the translated text
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  },

  // Batch translate multiple texts
  async preTranslate(texts: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    
    // Add each text as its own translation (mock implementation)
    texts.forEach(text => {
      if (text && text.trim() !== '') {
        result.set(text, text);
      }
    });
    
    return result;
  }
};

// Also export the service as a named export for backwards compatibility
export const staticTranslationService = staticTranslation;
