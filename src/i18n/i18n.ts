
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

// Language detection options
const detectionOptions = {
  order: ['localStorage', 'navigator'],
  lookupLocalStorage: 'i18nextLng',
  caches: ['localStorage']
};

// Debug function for all i18n operations
const debugI18n = (message: string, args?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[i18n] ${message}`, args);
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
    debug: true, // Enable debug for all environments to help troubleshoot
    supportedLngs: Object.keys(resources), // Explicitly set supported languages
    interpolation: {
      escapeValue: false // React already safes from XSS
    },
    detection: detectionOptions,
    react: {
      useSuspense: false, // This prevents issues with suspense during language loading
      bindI18n: 'languageChanged' // Re-render components when language changes
    }
  });

// Add all language change listeners to help debug
i18n.on('initialized', (options) => {
  debugI18n('i18next initialized', {
    languages: options.supportedLngs,
    fallbackLng: options.fallbackLng,
    lng: i18n.language,
    detectionOrder: options.detection?.order,
    localStorage: localStorage.getItem('i18nextLng')
  });
  
  // Set the html lang attribute
  document.documentElement.lang = i18n.language;
});

i18n.on('loaded', (loaded) => {
  debugI18n('i18next resources loaded', { loaded });
});

i18n.on('languageChanged', (lng) => {
  debugI18n(`Language changed to: ${lng}`, {
    previousLng: i18n.language,
    newLng: lng,
    localStorage: localStorage.getItem('i18nextLng'),
    documentLang: document.documentElement.lang
  });
  
  // Update the html lang attribute when language changes
  document.documentElement.lang = lng;
});

i18n.on('failedLoading', (lng, ns, msg) => {
  console.error(`[i18n] Failed loading language: ${lng}, namespace: ${ns}`, msg);
});

i18n.on('missingKey', (lngs, namespace, key, res) => {
  console.warn(`[i18n] Missing translation key: ${key} in namespace: ${namespace} for languages: ${lngs.join(', ')}`);
});

export default i18n;
