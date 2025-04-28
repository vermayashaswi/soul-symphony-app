
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translationCache } from '@/services/translationCache';
import { toast } from 'sonner';
import { staticTranslationService } from '@/services/staticTranslationService';

// Define the language options
export const languages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
];

interface TranslationContextType {
  isTranslating: boolean;
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
  translationProgress: number;
  translate: (text: string) => Promise<string>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Helper function to clean text of language markers
const cleanTextOfMarkers = (text: string): string => {
  if (!text) return '';
  return text.replace(/\[\w+\]\s*/g, '');
};

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translationProgress, setTranslationProgress] = useState(100);

  // Function to translate text using our service
  const translate = async (text: string): Promise<string> => {
    if (currentLanguage === 'en' || !text) return cleanTextOfMarkers(text);
    
    try {
      // Clean the text of any language markers before translation
      const cleanedText = cleanTextOfMarkers(text);
      
      console.log(`Translating text: "${cleanedText.substring(0, 30)}..." to ${currentLanguage}`);
      const translated = await staticTranslationService.translateText(cleanedText, currentLanguage);
      
      // Clean the result again in case translation somehow added markers
      const cleanedTranslated = cleanTextOfMarkers(translated);
      console.log(`Translation result: "${cleanedTranslated.substring(0, 30)}..."`);
      
      return cleanedTranslated;
    } catch (error) {
      console.error('Translation error in context:', error);
      return cleanTextOfMarkers(text); // Fallback to original cleaned text
    }
  };

  const setLanguage = async (lang: string) => {
    if (lang === currentLanguage) return;
    
    console.log(`Changing language from ${currentLanguage} to ${lang}`);
    setIsTranslating(true);
    setTranslationProgress(0);
    
    try {
      // Store language preference
      localStorage.setItem('preferredLanguage', lang);
      
      // Update the service language
      staticTranslationService.setLanguage(lang);
      
      // Set new language
      setCurrentLanguage(lang);
      
      // Dispatch language change event for components to react
      window.dispatchEvent(new CustomEvent('languageChange', { 
        detail: { 
          language: lang,
          timestamp: Date.now()
        } 
      }));
      
      const selectedLang = languages.find(l => l.code === lang);
      toast.success(`Language changed to ${selectedLang?.label || lang}`);
      
      // Force a component re-render by updating progress
      setTranslationProgress(50);
      setTimeout(() => {
        setTranslationProgress(100);
      }, 300);
    } catch (error) {
      console.error('Language change error:', error);
      toast.error('Failed to change language');
    } finally {
      setIsTranslating(false);
    }
  };

  // Initialize with stored preference
  useEffect(() => {
    const storedLang = localStorage.getItem('preferredLanguage');
    if (storedLang) {
      console.log(`Initializing with stored language preference: ${storedLang}`);
      setLanguage(storedLang);
    }
  }, []);

  return (
    <TranslationContext.Provider value={{ 
      isTranslating, 
      currentLanguage, 
      setLanguage,
      translationProgress,
      translate
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
