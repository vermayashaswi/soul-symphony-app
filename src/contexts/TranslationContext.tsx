
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { googleTranslateService } from '@/services/googleTranslateService';

export interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  setLanguage: (language: string) => void; // Added missing property
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  isTranslating: boolean;
  translationProgress: number; // Added missing property
  prefetchTranslationsForRoute: (texts: string[]) => void;
  getCachedTranslation: (text: string, language: string) => string | null; // Added missing property
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
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());

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

  const getCachedTranslation = useCallback((text: string, language: string): string | null => {
    const cacheKey = `${text}:${language}`;
    return translationCache.get(cacheKey) || null;
  }, [translationCache]);

  const translate = useCallback(async (text: string, sourceLanguage = 'en', entryId?: number): Promise<string> => {
    if (currentLanguage === 'en' || !text) {
      return text;
    }

    // Check cache first
    const cached = getCachedTranslation(text, currentLanguage);
    if (cached) {
      return cached;
    }

    try {
      setIsTranslating(true);
      setTranslationProgress(0);
      
      const translated = await googleTranslateService.translateText(text, sourceLanguage, currentLanguage);
      
      // Cache the result
      const cacheKey = `${text}:${currentLanguage}`;
      setTranslationCache(prev => new Map(prev.set(cacheKey, translated)));
      
      setTranslationProgress(100);
      return translated || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    } finally {
      setIsTranslating(false);
      setTranslationProgress(0);
    }
  }, [currentLanguage, getCachedTranslation]);

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
        setLanguage: handleLanguageChange, // Alias for compatibility
        translate,
        isTranslating,
        translationProgress,
        prefetchTranslationsForRoute,
        getCachedTranslation,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};
