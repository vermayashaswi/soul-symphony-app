
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
  if (process.env.NODE_ENV === 'development' || localStorage.getItem('debug_i18n') === 'true') {
    console.log(`[i18n] ${message}`, args);
  }
};

// Apply HTML lang attribute after language detection
const applyHtmlLang = (detected: string) => {
  const lang = detected || 'en';
  document.documentElement.lang = lang;
  debugI18n(`Applied language to HTML: ${lang}`);
  return lang;
};

// Helper to add data-i18n attributes to container elements for monitoring
const addTranslationMarkers = () => {
  debugI18n('Adding translation markers to page');
  
  // Wait for DOM to be ready
  setTimeout(() => {
    try {
      // Find main content containers and add data-i18n attribute
      const containers = document.querySelectorAll('main h1, main h2, main h3, main p, main button');
      containers.forEach((el, index) => {
        if (!el.hasAttribute('data-i18n')) {
          el.setAttribute('data-i18n', `container-${index}`);
        }
      });
      debugI18n(`Added translation markers to ${containers.length} elements`);
    } catch (e) {
      console.error('Error adding translation markers:', e);
    }
  }, 500);
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
      bindI18n: 'languageChanged loaded', // Re-render components when language changes or loads
      transSupportBasicHtmlNodes: true, // Support basic HTML nodes in translations
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span'] // Which HTML elements to keep
    }
  });

// Get initial language from localStorage or navigator
const initialLang = localStorage.getItem('i18nextLng') || navigator.language.split('-')[0];
applyHtmlLang(initialLang);

// Add all language change listeners to help debug
i18n.on('initialized', (options) => {
  const currentLang = i18n.language;
  debugI18n('i18next initialized', {
    languages: options.supportedLngs,
    fallbackLng: options.fallbackLng,
    lng: currentLang,
    detectionOrder: options.detection?.order,
    localStorage: localStorage.getItem('i18nextLng'),
    navigatorLanguage: navigator.language,
    documentLang: document.documentElement.lang
  });
  
  // Set the html lang attribute
  applyHtmlLang(currentLang);
  
  // Add translation markers to container elements
  addTranslationMarkers();
});

i18n.on('loaded', (loaded) => {
  debugI18n('i18next resources loaded', { loaded });
  
  // Check which translation keys were loaded
  const currentLng = i18n.language;
  const loadedNamespaces = Object.keys(i18n.store.data[currentLng] || {});
  
  debugI18n('Loaded translations', {
    language: currentLng,
    namespaces: loadedNamespaces,
    keysCount: Object.keys(i18n.store.data[currentLng]?.translation || {}).length
  });
  
  // Add translation markers again after resources are loaded
  addTranslationMarkers();
});

i18n.on('languageChanged', (lng) => {
  debugI18n(`Language changed to: ${lng}`, {
    previousLng: document.documentElement.lang,
    newLng: lng,
    localStorage: localStorage.getItem('i18nextLng'),
    navigatorLanguage: navigator.language,
    translations: Object.keys(i18n.store.data[lng]?.translation || {}).length
  });
  
  // Update the html lang attribute when language changes
  applyHtmlLang(lng);
  
  // Add translation markers to container elements after language change
  addTranslationMarkers();
  
  // Force update any listeners
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lng } }));
});

i18n.on('failedLoading', (lng, ns, msg) => {
  console.error(`[i18n] Failed loading language: ${lng}, namespace: ${ns}`, msg);
});

i18n.on('missingKey', (lngs, namespace, key, res) => {
  console.warn(`[i18n] Missing translation key: ${key} in namespace: ${namespace} for languages: ${lngs.join(', ')}`);
});

// Add a global method to test translation completeness
(window as any).testTranslations = (lang: string) => {
  i18n.changeLanguage(lang);
  const results: Record<string, any> = {};
  
  // Get all translation keys from the default language (usually English)
  const defaultLang = 'en';
  const defaultKeys = Object.keys(i18n.store.data[defaultLang]?.translation || {});
  
  // Check which keys are missing in the target language
  const targetKeys = Object.keys(i18n.store.data[lang]?.translation || {});
  const missingKeys = defaultKeys.filter(key => !targetKeys.includes(key));
  
  results.language = lang;
  results.translatedKeys = targetKeys.length;
  results.totalKeys = defaultKeys.length;
  results.completionPercentage = Math.round((targetKeys.length / defaultKeys.length) * 100);
  results.missingKeys = missingKeys;
  
  console.table({
    Language: lang,
    'Translated Keys': targetKeys.length,
    'Total Keys': defaultKeys.length,
    'Completion %': results.completionPercentage + '%',
    'Missing Keys': missingKeys.length
  });
  
  return results;
};

export default i18n;
