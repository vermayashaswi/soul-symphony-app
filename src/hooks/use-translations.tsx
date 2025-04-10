
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  SupportedLanguage,
  TranslationKeys,
  translations,
  getCurrentLanguage
} from '@/utils/translations';

interface TranslationContextType {
  t: TranslationKeys;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(getCurrentLanguage());
  const [t, setTranslations] = useState<TranslationKeys>(translations[language]);
  
  const setLanguage = (lang: SupportedLanguage) => {
    localStorage.setItem('preferredLanguage', lang);
    setLanguageState(lang);
    document.documentElement.lang = lang;
    
    // In a real app, you might want to set text direction for RTL languages
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  };
  
  // Update translations when language changes
  useEffect(() => {
    setTranslations(translations[language]);
  }, [language]);
  
  // Listen for language change events
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      const lang = e.detail?.language as SupportedLanguage;
      if (lang && translations[lang]) {
        setLanguage(lang);
      }
    };
    
    window.addEventListener('language-changed', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('language-changed', handleLanguageChange as EventListener);
    };
  }, []);
  
  return (
    <TranslationContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslations = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  
  if (context === undefined) {
    throw new Error('useTranslations must be used within a TranslationProvider');
  }
  
  return context;
};

export default useTranslations;
