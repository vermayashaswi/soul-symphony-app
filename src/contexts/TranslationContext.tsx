import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translationService } from '@/services/translationService';
import { staticTranslationService } from '@/services/staticTranslationService';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { simplifiedFontService } from '@/services/simplifiedFontService';

interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  translate: (text: string, sourceLanguage?: string) => Promise<string | null>;
  isTranslating: boolean;
  clearCache: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize with browser language or default to English
    const browserLanguage = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'hi', 'ar', 'bn', 'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
    
    if (supportedLanguages.includes(browserLanguage)) {
      setCurrentLanguage(browserLanguage);
    }
  }, []);

  const translate = async (text: string, sourceLanguage: string = 'en'): Promise<string | null> => {
    if (!text || typeof text !== 'string') {
      console.warn('[TranslationContext] Invalid text provided for translation:', text);
      return text || '';
    }

    if (currentLanguage === sourceLanguage) {
      return text;
    }

    const cacheKey = `${text}_${sourceLanguage}_${currentLanguage}`;
    
    // Check local cache first
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    // Check on-demand cache
    const cachedTranslation = onDemandTranslationCache.get(currentLanguage, text);
    if (cachedTranslation) {
      setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
      return cachedTranslation;
    }

    try {
      setIsTranslating(true);
      
      // Use static translation service for common UI elements
      let translatedText = staticTranslationService.translate(text, currentLanguage);
      
      if (!translatedText || translatedText === text) {
        // Fall back to dynamic translation service
        translatedText = await translationService.translateText(text, currentLanguage, sourceLanguage);
      }

      if (translatedText && translatedText !== text) {
        // Cache both locally and in on-demand cache
        setTranslationCache(prev => ({ ...prev, [cacheKey]: translatedText }));
        onDemandTranslationCache.set(currentLanguage, text, translatedText);
        
        // Pre-load font for the detected script
        const fontUrl = simplifiedFontService.getFontUrl(translatedText);
        console.log(`[TranslationContext] Pre-loading font for translated text: ${fontUrl}`);
        
        return translatedText;
      }
      
      return text;
    } catch (error) {
      console.error('[TranslationContext] Translation failed:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  };

  const value: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage,
    translate,
    isTranslating,
    clearCache: () => {
      setTranslationCache({});
      onDemandTranslationCache.clearAll();
    }
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
