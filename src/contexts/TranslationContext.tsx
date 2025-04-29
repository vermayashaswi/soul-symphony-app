
import React, { createContext, useContext, useState, useEffect } from 'react';
import { staticTranslationService } from '@/services/staticTranslationService';

// Define the supported languages
export const languages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'or', label: 'Odia (ଓଡ଼ିଆ)' }
];

type TranslationContextType = {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  isTranslating: boolean;
  translationProgress: number;
};

const TranslationContext = createContext<TranslationContextType>({
  currentLanguage: 'en',
  setLanguage: () => {},
  translate: async () => '',
  isTranslating: false,
  translationProgress: 0
});

export const useTranslation = () => useContext(TranslationContext);

export const TranslationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationProgress, setTranslationProgress] = useState<number>(0);
  const [translationQueue, setTranslationQueue] = useState<number>(0);
  const [translationsCompleted, setTranslationsCompleted] = useState<number>(0);

  useEffect(() => {
    // Check for stored language preference
    const storedLanguage = localStorage.getItem('preferredLanguage');
    if (storedLanguage) {
      setCurrentLanguage(storedLanguage);
      staticTranslationService.setLanguage(storedLanguage);
    }
  }, []);

  // Reset progress when language changes
  useEffect(() => {
    if (translationQueue === 0) {
      setTranslationProgress(0);
      setIsTranslating(false);
    } else {
      const progress = Math.round((translationsCompleted / translationQueue) * 100);
      setTranslationProgress(progress);
      setIsTranslating(translationsCompleted < translationQueue);
    }
  }, [translationQueue, translationsCompleted]);

  const setLanguage = (language: string) => {
    setCurrentLanguage(language);
    staticTranslationService.setLanguage(language);
    localStorage.setItem('preferredLanguage', language);
    
    // Reset translation tracking
    setTranslationsCompleted(0);
    setTranslationQueue(0);
    setTranslationProgress(0);
    
    // Dispatch event for components to react to language change
    window.dispatchEvent(
      new CustomEvent('languageChange', { detail: { language } })
    );
  };

  const translate = async (text: string, sourceLanguage?: string, entryId?: number): Promise<string> => {
    // Skip translation if target language is English
    if (currentLanguage === 'en') {
      return text;
    }

    // Increment queue when a new translation starts
    setTranslationQueue(prev => prev + 1);
    setIsTranslating(true);
    
    try {
      const result = await staticTranslationService.translateText(text, undefined, sourceLanguage, entryId);
      
      // Increment completed translations
      setTranslationsCompleted(prev => prev + 1);
      
      return result;
    } catch (error) {
      console.error('Translation error:', error);
      
      // Count failed translations as completed
      setTranslationsCompleted(prev => prev + 1);
      
      return text;
    }
  };

  return (
    <TranslationContext.Provider value={{ 
      currentLanguage, 
      setLanguage, 
      translate, 
      isTranslating,
      translationProgress 
    }}>
      {children}
    </TranslationContext.Provider>
  );
};
