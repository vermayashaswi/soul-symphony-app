
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translationCache } from '@/services/translationCache';
import { toast } from 'sonner';
import { languages } from '@/components/LanguageSelector';

interface TranslationContextType {
  isTranslating: boolean;
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
  translationProgress: number;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translationProgress, setTranslationProgress] = useState(100);

  const setLanguage = async (lang: string) => {
    if (lang === currentLanguage) return;
    
    setIsTranslating(true);
    setTranslationProgress(0);
    
    try {
      // Store language preference
      localStorage.setItem('preferredLanguage', lang);
      
      // Pre-warm cache for common UI elements
      const commonElements = document.querySelectorAll('[data-i18n]');
      let processedElements = 0;
      
      for (const element of commonElements) {
        const text = element.textContent;
        if (text) {
          await translationCache.getTranslation(text, lang);
        }
        processedElements++;
        setTranslationProgress(Math.round((processedElements / commonElements.length) * 100));
      }

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
    } catch (error) {
      console.error('Language change error:', error);
      toast.error('Failed to change language');
    } finally {
      setIsTranslating(false);
      setTranslationProgress(100);
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
      translationProgress 
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
