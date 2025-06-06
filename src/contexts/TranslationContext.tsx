
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { translationService } from '@/services/translationService';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  setLanguage: (language: string) => void; // Alias for backwards compatibility
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string | null>;
  isTranslating: boolean;
  clearCache: () => void;
  getCachedTranslation: (text: string) => string | null;
  translationProgress?: number;
  prefetchTranslationsForRoute?: (route: string) => Promise<void>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});
  const [translationProgress, setTranslationProgress] = useState<number>(0);

  // Load language from localStorage or browser default
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('soulo-language');
      if (savedLanguage) {
        console.log('[TranslationContext] Loading saved language:', savedLanguage);
        setCurrentLanguage(savedLanguage);
        return;
      }
    } catch (error) {
      console.error('[TranslationContext] Error loading saved language:', error);
    }

    // Fallback to browser language
    const browserLanguage = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'hi', 'ar', 'bn', 'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
    
    if (supportedLanguages.includes(browserLanguage)) {
      setCurrentLanguage(browserLanguage);
    }
    
    console.log('[TranslationContext] Initialized with language:', browserLanguage, 'supported:', supportedLanguages.includes(browserLanguage));
  }, []);

  const handleLanguageChange = useCallback((language: string) => {
    console.log('[TranslationContext] Changing language to:', language);
    setCurrentLanguage(language);
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('soulo-language', language);
      console.log('[TranslationContext] Saved language to localStorage:', language);
    } catch (error) {
      console.error('[TranslationContext] Error saving language to localStorage:', error);
    }
    
    // Dispatch custom event for components that need to know about language changes
    const event = new CustomEvent('languageChange', { detail: { language } });
    window.dispatchEvent(event);
  }, []);

  const translate = useCallback(async (text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string | null> => {
    if (!text || typeof text !== 'string') {
      console.warn('[TranslationContext] Invalid text provided for translation:', text);
      return text || '';
    }

    if (currentLanguage === sourceLanguage) {
      console.log('[TranslationContext] Text already in target language, skipping translation:', { text, currentLanguage });
      return text;
    }

    console.log('[TranslationContext] GOOGLE TRANSLATE ONLY - Attempting to translate:', { 
      text: text.substring(0, 30) + (text.length > 30 ? '...' : ''), 
      from: sourceLanguage, 
      to: currentLanguage,
      entryId
    });

    const cacheKey = `${text}_${sourceLanguage}_${currentLanguage}`;
    
    // Check local cache first
    if (translationCache[cacheKey]) {
      console.log('[TranslationContext] Using local cache for:', text.substring(0, 30));
      return translationCache[cacheKey];
    }

    // Check on-demand cache
    const cachedTranslation = onDemandTranslationCache.get(currentLanguage, text);
    if (cachedTranslation) {
      console.log('[TranslationContext] Using on-demand cache for:', text.substring(0, 30));
      setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
      return cachedTranslation;
    }

    try {
      setIsTranslating(true);
      setTranslationProgress(30);
      
      // ONLY USE GOOGLE TRANSLATE SERVICE
      console.log('[TranslationContext] Using Google Translate service only');
      const translatedText = await translationService.translateText(text, currentLanguage, sourceLanguage);

      if (translatedText && translatedText !== text) {
        console.log('[TranslationContext] Translation successful:', { 
          original: text.substring(0, 30), 
          translated: translatedText.substring(0, 30) 
        });
        
        // Update both caches
        setTranslationCache(prev => ({ ...prev, [cacheKey]: translatedText }));
        onDemandTranslationCache.set(currentLanguage, text, translatedText);
        
        setTranslationProgress(100);
        return translatedText;
      } else {
        console.log('[TranslationContext] Translation returned same text, using original');
        setTranslationProgress(100);
        return text;
      }
    } catch (error) {
      console.error('[TranslationContext] Translation failed:', error);
      setTranslationProgress(0);
      return text; // Fallback to original text
    } finally {
      setIsTranslating(false);
      // Reset progress after a delay
      setTimeout(() => setTranslationProgress(0), 1000);
    }
  }, [currentLanguage, translationCache]);

  const clearCache = useCallback(() => {
    console.log('[TranslationContext] Clearing translation cache');
    setTranslationCache({});
    onDemandTranslationCache.clearAll();
  }, []);

  const getCachedTranslation = useCallback((text: string): string | null => {
    const cacheKey = `${text}_en_${currentLanguage}`;
    return translationCache[cacheKey] || onDemandTranslationCache.get(currentLanguage, text) || null;
  }, [currentLanguage, translationCache]);

  const prefetchTranslationsForRoute = useCallback(async (route: string): Promise<void> => {
    if (currentLanguage === 'en') return;
    
    console.log('[TranslationContext] Prefetching translations for route:', route);
    // This could be expanded to preload common texts for specific routes
  }, [currentLanguage]);

  const value: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage: handleLanguageChange,
    setLanguage: handleLanguageChange, // Alias
    translate,
    isTranslating,
    clearCache,
    getCachedTranslation,
    translationProgress,
    prefetchTranslationsForRoute
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
