
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enTranslation from './locales/en.json';
import esTranslation from './locales/es.json';
import frTranslation from './locales/fr.json';
import deTranslation from './locales/de.json';
import zhTranslation from './locales/zh.json';
import jaTranslation from './locales/ja.json';
import ruTranslation from './locales/ru.json';
import ptTranslation from './locales/pt.json';
import arTranslation from './locales/ar.json';
import hiTranslation from './locales/hi.json';
import itTranslation from './locales/it.json';
import koTranslation from './locales/ko.json';
import bnTranslation from './locales/bn.json';
import taTranslation from './locales/ta.json';
import teTranslation from './locales/te.json';
import mrTranslation from './locales/mr.json';
import guTranslation from './locales/gu.json';
import knTranslation from './locales/kn.json';
import mlTranslation from './locales/ml.json';
import paTranslation from './locales/pa.json';
import orTranslation from './locales/or.json';

// Resources for i18next
const resources = {
  en: {
    translation: enTranslation
  },
  es: {
    translation: esTranslation
  },
  fr: {
    translation: frTranslation
  },
  de: {
    translation: deTranslation
  },
  zh: {
    translation: zhTranslation
  },
  ja: {
    translation: jaTranslation
  },
  ru: {
    translation: ruTranslation
  },
  pt: {
    translation: ptTranslation
  },
  ar: {
    translation: arTranslation
  },
  hi: {
    translation: hiTranslation
  },
  it: {
    translation: itTranslation
  },
  ko: {
    translation: koTranslation
  },
  bn: {
    translation: bnTranslation
  },
  ta: {
    translation: taTranslation
  },
  te: {
    translation: teTranslation
  },
  mr: {
    translation: mrTranslation
  },
  gu: {
    translation: guTranslation
  },
  kn: {
    translation: knTranslation
  },
  ml: {
    translation: mlTranslation
  },
  pa: {
    translation: paTranslation
  },
  or: {
    translation: orTranslation
  }
};

// Initialize i18next
i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false // React already safes from XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },
    react: {
      useSuspense: false // This prevents issues with suspense during language loading
    }
  });

// Add a language change listener to help debug
i18n.on('languageChanged', (lng) => {
  console.log(`Language changed to: ${lng}`);
});

export default i18n;
