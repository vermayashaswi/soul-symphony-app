
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

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translationProgress, setTranslationProgress] = useState(100);

  // Function to translate text using our service
  const translate = async (text: string): Promise<string> => {
    if (currentLanguage === 'en' || !text) return text;
    return staticTranslationService.translateText(text, currentLanguage);
  };

  const setLanguage = async (lang: string) => {
    if (lang === currentLanguage) return;
    
    setIsTranslating(true);
    setTranslationProgress(0);
    
    try {
      // Store language preference
      localStorage.setItem('preferredLanguage', lang);
      
      // Update the service language
      staticTranslationService.setLanguage(lang);
      
      // For simplicity, we'll just set the progress to 100% right away
      // In a real implementation, you'd want to translate common UI elements here
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
      
      setTranslationProgress(100);
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
