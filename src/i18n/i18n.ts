
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
  // Always enable debug for now to troubleshoot the Hindi translation issue
  console.log(`[i18n] ${message}`, args);
};

// Apply HTML lang attribute after language detection
const applyHtmlLang = (detected: string) => {
  const lang = detected || 'en';
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-language', lang); // Additional marker for CSS targeting
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

// Force reload translations if needed
const forceReloadTranslations = (lng: string) => {
  // This is a hack to force reload translations if they're not loading properly
  const reloadPromise = i18n.reloadResources(lng);
  debugI18n(`Forced reload of translations for ${lng}`);
  return reloadPromise;
};

// Verify translation completeness
const verifyTranslationCompleteness = (lng: string) => {
  debugI18n(`Verifying translation completeness for ${lng}`);
  
  if (!i18n.store.data[lng]?.translation) {
    debugI18n(`WARNING: No translations found for ${lng}`, {
      availableLanguages: Object.keys(i18n.store.data),
      resourcesState: i18n.store.data
    });
    return false;
  }
  
  const targetTranslation = i18n.store.data[lng].translation;
  const englishTranslation = i18n.store.data.en.translation;
  
  const targetKeys = Object.keys(targetTranslation || {}).length;
  const englishKeys = Object.keys(englishTranslation || {}).length;
  
  const completionPercentage = Math.round((targetKeys / englishKeys) * 100);
  
  debugI18n(`Translation completeness for ${lng}: ${completionPercentage}% (${targetKeys}/${englishKeys} keys)`, {
    targetTranslation,
    englishKeyCount: englishKeys,
    targetKeyCount: targetKeys
  });
  
  return completionPercentage >= 70; // Consider it complete enough if at least 70% translated
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
  
  // Verify the initial language translations are complete
  verifyTranslationCompleteness(currentLang);
  
  // Force load the current language in case it wasn't loaded properly
  forceReloadTranslations(currentLang);
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
  
  // Verify the translations are complete
  verifyTranslationCompleteness(currentLng);
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
  
  // Force load the translations for the new language in case they weren't loaded properly
  forceReloadTranslations(lng);
  
  // Verify the translations are complete
  verifyTranslationCompleteness(lng);
  
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

// Add a debug helper
(window as any).debugLangState = () => {
  console.group('i18n Language State Debug Info');
  console.log('Current language:', i18n.language);
  console.log('Detected languages:', i18n.languages);
  console.log('HTML lang attribute:', document.documentElement.lang);
  console.log('localStorage language:', localStorage.getItem('i18nextLng'));
  console.log('navigator.language:', navigator.language);
  console.log('Available languages in store:', Object.keys(i18n.store.data));
  
  if (i18n.store.data[i18n.language]?.translation) {
    console.log(`Keys for ${i18n.language}:`, Object.keys(i18n.store.data[i18n.language].translation).length);
  } else {
    console.warn(`No translations found for ${i18n.language}`);
  }
  
  console.groupEnd();
  
  return {
    currentLang: i18n.language,
    htmlLang: document.documentElement.lang,
    storedLang: localStorage.getItem('i18nextLng'),
    navLang: navigator.language,
    availableLangs: Object.keys(i18n.store.data),
    translationKeys: i18n.store.data[i18n.language]?.translation ? 
      Object.keys(i18n.store.data[i18n.language].translation).length : 0
  };
};

export default i18n;
