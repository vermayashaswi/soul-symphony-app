
import React, { createContext, useContext, useState, useEffect } from 'react';
import { staticTranslationService } from '@/services/staticTranslationService';

type TranslationContextType = {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
};

const TranslationContext = createContext<TranslationContextType>({
  currentLanguage: 'en',
  setLanguage: () => {},
  translate: async () => '',
});

export const useTranslation = () => useContext(TranslationContext);

export const TranslationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');

  useEffect(() => {
    // Check for stored language preference
    const storedLanguage = localStorage.getItem('preferredLanguage');
    if (storedLanguage) {
      setCurrentLanguage(storedLanguage);
      staticTranslationService.setLanguage(storedLanguage);
    }
  }, []);

  const setLanguage = (language: string) => {
    setCurrentLanguage(language);
    staticTranslationService.setLanguage(language);
    localStorage.setItem('preferredLanguage', language);
    
    // Dispatch event for components to react to language change
    window.dispatchEvent(
      new CustomEvent('languageChange', { detail: { language } })
    );
  };

  const translate = async (text: string, sourceLanguage?: string, entryId?: number): Promise<string> => {
    return await staticTranslationService.translateText(text, undefined, sourceLanguage, entryId);
  };

  return (
    <TranslationContext.Provider value={{ currentLanguage, setLanguage, translate }}>
      {children}
    </TranslationContext.Provider>
  );
};
