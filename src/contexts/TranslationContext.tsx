
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
      
      // ONLY USE GOOGLE TRANSLATE SERVICE
      console.log('[TranslationContext] Using Google Translate service only');
      const translatedText = await translationService.translateText(text, currentLanguage, sourceLanguage);

      if (translatedText && translatedText !== text) {
        console.log('[TranslationContext] Translation successful:', { 
          original: text.substring(0, 30), 
          translated: translatedText.substring(0, 30) 
        });
        
        // Cache both locally and in on-demand cache
        setTranslationCache(prev => ({ ...prev, [cacheKey]: translatedText }));
        onDemandTranslationCache.set(currentLanguage, text, translatedText);
        
        return translatedText;
      }
      
      console.log('[TranslationContext] Translation returned same text, using original');
      return text;
    } catch (error) {
      console.error('[TranslationContext] Translation failed:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [currentLanguage, translationCache]);

  const getCachedTranslation = useCallback((text: string): string | null => {
    const cacheKey = `${text}_en_${currentLanguage}`;
    const localCache = translationCache[cacheKey];
    const onDemandCache = onDemandTranslationCache.get(currentLanguage, text);
    console.log('[TranslationContext] Checking cache for:', text.substring(0, 30), 
      { localCache: !!localCache, onDemandCache: !!onDemandCache });
    return localCache || onDemandCache || null;
  }, [currentLanguage, translationCache]);

  const prefetchTranslationsForRoute = useCallback(async (route: string): Promise<void> => {
    console.log(`[TranslationContext] Prefetching translations for route: ${route}`);
    // Get common route texts for prefetching - can be expanded
    const routeTexts = {
      '/': ['Home', 'Download on App Store', 'Your Voice, Your Journey'],
      '/insights': ['Insights', 'Discover patterns', 'Soul-Net Visualization', 'Dominant Mood'],
      '/journal': ['Journal', 'New Entry', 'Search', 'Recent Entries']
    };
    
    const textsToTranslate = routeTexts[route] || [];
    if (textsToTranslate.length > 0 && currentLanguage !== 'en') {
      try {
        const batchResults = await translationService.batchTranslate({
          texts: textsToTranslate,
          targetLanguage: currentLanguage
        });
        console.log(`[TranslationContext] Prefetched ${batchResults.size} translations for route ${route}`);
      } catch (error) {
        console.error('[TranslationContext] Error prefetching translations:', error);
      }
    }
  }, [currentLanguage]);

  const value: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage: handleLanguageChange,
    setLanguage: handleLanguageChange, // Alias for backwards compatibility
    translate,
    isTranslating,
    clearCache: useCallback(() => {
      console.log('[TranslationContext] Clearing all translation caches');
      setTranslationCache({});
      onDemandTranslationCache.clearAll();
    }, []),
    getCachedTranslation,
    translationProgress: isTranslating ? 50 : 100,
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
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
