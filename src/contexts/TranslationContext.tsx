
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translationCache } from '@/services/translationCache';
import { toast } from 'sonner';

interface TranslationContextType {
  isTranslating: boolean;
  currentLanguage: string;
  setLanguage: (lang: string) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const setLanguage = async (lang: string) => {
    if (lang === currentLanguage) return;
    
    setIsTranslating(true);
    try {
      // Store language preference
      localStorage.setItem('preferredLanguage', lang);
      setCurrentLanguage(lang);
      
      // Dispatch language change event for components to react
      window.dispatchEvent(new CustomEvent('languageChange', { 
        detail: { language: lang } 
      }));
      
      toast.success(`Language changed to ${lang}`);
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
    <TranslationContext.Provider value={{ isTranslating, currentLanguage, setLanguage }}>
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
