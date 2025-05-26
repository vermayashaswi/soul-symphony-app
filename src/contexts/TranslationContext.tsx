
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { googleTranslateService } from '@/services/googleTranslateService';

export interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  isTranslating: boolean;
  prefetchTranslationsForRoute: (texts: string[]) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);

  // Load saved language preference
  useEffect(() => {
    const savedLanguage = localStorage.getItem('soulo_language');
    if (savedLanguage && savedLanguage !== 'en') {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  // Save language preference
  const handleLanguageChange = useCallback((language: string) => {
    setCurrentLanguage(language);
    localStorage.setItem('soulo_language', language);
    
    // Dispatch custom event for components that need to react to language changes
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { language } }));
  }, []);

  const translate = useCallback(async (text: string, sourceLanguage = 'en', entryId?: number): Promise<string> => {
    if (currentLanguage === 'en' || !text) {
      return text;
    }

    try {
      setIsTranslating(true);
      const translated = await googleTranslateService.translateText(text, sourceLanguage, currentLanguage);
      return translated || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [currentLanguage]);

  const prefetchTranslationsForRoute = useCallback((texts: string[]) => {
    if (currentLanguage === 'en') return;
    
    // Batch translate common texts in the background
    texts.forEach(text => {
      if (text) {
        translate(text).catch(console.error);
      }
    });
  }, [translate, currentLanguage]);

  return (
    <TranslationContext.Provider
      value={{
        currentLanguage,
        setCurrentLanguage: handleLanguageChange,
        translate,
        isTranslating,
        prefetchTranslationsForRoute,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};
