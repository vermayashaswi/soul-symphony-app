
import React, { createContext, useContext, useState, useEffect } from 'react';
import { TranslationService } from '@/services/translationService';
import { translationCache } from '@/services/translationCache';
import { staticTranslation } from '@/services/staticTranslationService';
import { useToast } from "@/hooks/use-toast";

// Define the context shape
interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  getStaticTranslation: (key: string) => string;
  loadingTranslation: boolean;
  getCachedTranslation: (text: string, language: string) => string | null;
}

// Create the context
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Translation provider component
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [loadingTranslation, setLoadingTranslation] = useState<boolean>(false);
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
      
      // Get translation from service
      const translatedText = await TranslationService.translateText({
        text,
        sourceLanguage: sourceLanguage || "en", // Default to English if not provided
        targetLanguage: currentLanguage,
        entryId
      });
      
      return translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      return text; // Return original text on error
    } finally {
      setLoadingTranslation(false);
    }
  };

  // Get static translation from imported static translations
  const getStaticTranslation = (key: string): string => {
    return staticTranslation.get(key, currentLanguage) || key;
  };
  
  // Get cached translation if available
  const getCachedTranslation = (text: string, language: string): string | null => {
    const cached = translationCache.getCachedTranslation(text, language);
    return cached ? cached.translatedText : null;
  };

  // Create the context value
  const contextValue: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage,
    translate,
    getStaticTranslation,
    loadingTranslation,
    getCachedTranslation
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
