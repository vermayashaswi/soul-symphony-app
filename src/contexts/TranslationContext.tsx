
import React, { createContext, useContext, useState, useEffect } from 'react';
import { TranslationService } from '@/services/translationService';
import { translationCache } from '@/services/translationCache';
import { staticTranslation } from '@/services/staticTranslationService';
import { useToast } from "@/hooks/use-toast";

// Define the context shape
interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  setLanguage: (language: string) => void; // Alias for setCurrentLanguage for compatibility
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  getStaticTranslation: (key: string) => string;
  loadingTranslation: boolean;
  isTranslating: boolean; // Added for compatibility
  translationProgress: number; // Added for progress indicator
  getCachedTranslation: (text: string, language: string) => string | null;
  prefetchTranslationsForRoute: (texts: string[]) => void; // For route-based translation prefetching
}

// Create the context
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Translation provider component
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [loadingTranslation, setLoadingTranslation] = useState<boolean>(false);
  const [translationProgress, setTranslationProgress] = useState<number>(0);
  const { toast } = useToast();

  // Load language preference from localStorage on initial render
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  // Save language preference when it changes
  useEffect(() => {
    localStorage.setItem('preferred-language', currentLanguage);
    
    // Dispatch a custom event to notify components about language change
    const event = new Event('languageChange');
    window.dispatchEvent(event);
  }, [currentLanguage]);

  // Function to translate text
  const translate = async (text: string, sourceLanguage?: string, entryId?: number): Promise<string> => {
    // Skip translation for empty text or if current language is English and no source language is specified
    if (!text || text.trim() === '') return text;
    
    // No need to translate if source language matches the target language
    if (sourceLanguage === currentLanguage) return text;
    
    try {
      setLoadingTranslation(true);
      setTranslationProgress(25); // Start progress indicator
      
      // Get translation from service
      const translatedText = await TranslationService.translateText({
        text,
        sourceLanguage: sourceLanguage || "en", // Default to English if not provided
        targetLanguage: currentLanguage,
        entryId
      });
      
      setTranslationProgress(100); // Complete progress
      return translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      return text; // Return original text on error
    } finally {
      setTranslationProgress(0);
      setLoadingTranslation(false);
    }
  };

  // Get static translation from imported static translations
  const getStaticTranslation = (key: string): string => {
    return staticTranslation.get(key, currentLanguage) || key;
  };
  
  // Get cached translation if available
  const getCachedTranslation = (text: string, language: string): string | null => {
    return translationCache.getTranslation(text, language)
      .then(cached => cached?.translatedText || null)
      .catch(() => null);
  };

  // Prefetch translations for route change
  const prefetchTranslationsForRoute = (texts: string[]) => {
    if (currentLanguage === 'en' || !texts.length) return;
    
    // No need to wait for this, just kick off the batch translation
    TranslationService.batchTranslate({
      texts: texts.filter(Boolean),
      targetLanguage: currentLanguage
    }).then(() => {
      console.log(`Prefetched ${texts.length} translations for route`);
    }).catch(err => {
      console.error('Error prefetching translations:', err);
    });
  };

  // Create the context value
  const contextValue: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage,
    setLanguage: setCurrentLanguage, // Alias for compatibility
    translate,
    getStaticTranslation,
    loadingTranslation,
    isTranslating: loadingTranslation, // Alias for compatibility
    translationProgress,
    getCachedTranslation,
    prefetchTranslationsForRoute
  };

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

// Custom hook to use the translation context
export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
