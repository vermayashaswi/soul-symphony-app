
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
  }
};

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
      caches: ['localStorage']
    }
  });

export default i18n;
