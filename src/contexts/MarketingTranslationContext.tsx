
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface MarketingTranslationContextType {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  isTranslating: boolean;
}

const MarketingTranslationContext = createContext<MarketingTranslationContextType | undefined>(undefined);

interface MarketingTranslationProviderProps {
  children: ReactNode;
}

export const MarketingTranslationProvider: React.FC<MarketingTranslationProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Load language from localStorage or browser default
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('soulo-language');
      if (savedLanguage) {
        console.log('[MarketingTranslationContext] Loading saved language:', savedLanguage);
        setCurrentLanguage(savedLanguage);
        return;
      }
    } catch (error) {
      console.error('[MarketingTranslationContext] Error loading saved language:', error);
    }

    // Fallback to browser language
    const browserLanguage = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'hi', 'ar'];
    
    if (supportedLanguages.includes(browserLanguage)) {
      setCurrentLanguage(browserLanguage);
    }
    
    console.log('[MarketingTranslationContext] Initialized with language:', browserLanguage);
  }, []);

  const handleLanguageChange = useCallback((language: string) => {
    console.log('[MarketingTranslationContext] Changing language to:', language);
    setCurrentLanguage(language);
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('soulo-language', language);
      console.log('[MarketingTranslationContext] Saved language to localStorage:', language);
    } catch (error) {
      console.error('[MarketingTranslationContext] Error saving language to localStorage:', error);
    }
  }, []);

  const value: MarketingTranslationContextType = {
    currentLanguage,
    setLanguage: handleLanguageChange,
    isTranslating
  };

  return (
    <MarketingTranslationContext.Provider value={value}>
      {children}
    </MarketingTranslationContext.Provider>
  );
};

export const useMarketingTranslation = (): MarketingTranslationContextType => {
  const context = useContext(MarketingTranslationContext);
  if (context === undefined) {
    throw new Error('useMarketingTranslation must be used within a MarketingTranslationProvider');
  }
  return context;
};
