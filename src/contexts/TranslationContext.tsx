
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { translationService } from '@/services/translationService';
import { supabase } from '@/integrations/supabase/client';

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
  prefetchSoulNetTranslations: (userId: string, timeRange: string) => Promise<void>;
  isSoulNetTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isSoulNetTranslating, setIsSoulNetTranslating] = useState<boolean>(false);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});

  // APP-LEVEL: Set up translation service integration on context initialization
  useEffect(() => {
    console.log('[TranslationContext] APP-LEVEL: Setting up coordinated translation service integration');
    
    // Register translation service with EnhancedSoulNetPreloadService
    EnhancedSoulNetPreloadService.setAppLevelTranslationService(translationService);
    
    console.log('[TranslationContext] APP-LEVEL: Coordinated translation service integration complete');
  }, []);

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

  const prefetchSoulNetTranslations = useCallback(async (userId: string, timeRange: string): Promise<void> => {
    if (currentLanguage === 'en') {
      console.log('[TranslationContext] Skipping SoulNet pre-translation for English');
      return;
    }

    console.log(`[TranslationContext] APP-LEVEL: Pre-translating SoulNet data for ${userId}, ${timeRange}, ${currentLanguage}`);
    
    try {
      setIsSoulNetTranslating(true);
      
      // ENHANCED: Use enhanced preload service for coordinated translation
      await EnhancedSoulNetPreloadService.preloadInstantData(userId, timeRange, currentLanguage);
      
      console.log('[TranslationContext] APP-LEVEL: SoulNet coordinated pre-translation completed successfully');
    } catch (error) {
      console.error('[TranslationContext] APP-LEVEL: Error in coordinated pre-translation:', error);
    } finally {
      setIsSoulNetTranslating(false);
    }
  }, [currentLanguage]);

  const handleLanguageChange = useCallback(async (language: string) => {
    console.log('[TranslationContext] APP-LEVEL: Coordinated language change to:', language);
    
    // Set loading state for SoulNet translations
    if (language !== 'en') {
      setIsSoulNetTranslating(true);
    }
    
    setCurrentLanguage(language);
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('soulo-language', language);
      console.log('[TranslationContext] APP-LEVEL: Saved language to localStorage:', language);
    } catch (error) {
      console.error('[TranslationContext] APP-LEVEL: Error saving language to localStorage:', error);
    }
    
    // ENHANCED: Clear coordinated caches when language changes
    EnhancedSoulNetPreloadService.clearInstantCache();
    SoulNetPreloadService.clearCache();
    
    // ENHANCED: Clear translation service cache for the new language
    await translationService.clearLanguageCache(language);
    
    console.log('[TranslationContext] APP-LEVEL: Cleared all coordinated caches for language change');
    
    // Dispatch custom event for components that need to know about language changes
    const event = new CustomEvent('languageChange', { 
      detail: { 
        language,
        isSoulNetTranslating: language !== 'en'
      } 
    });
    window.dispatchEvent(event);
    
    // If not English, indicate that SoulNet translations are ready
    // (actual pre-translation will happen when SoulNet components mount)
    if (language === 'en') {
      setIsSoulNetTranslating(false);
    }
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

    console.log('[TranslationContext] COORDINATED TRANSLATION - Attempting to translate:', { 
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

    // ENHANCED: Use coordinated translation service
    const cachedTranslation = await translationService.getCachedTranslation(text, currentLanguage);
    if (cachedTranslation) {
      console.log('[TranslationContext] Using coordinated cache for:', text.substring(0, 30));
      setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
      return cachedTranslation;
    }

    try {
      setIsTranslating(true);
      
      console.log('[TranslationContext] Using coordinated translation service');
      
      // ENHANCED: Use coordinated translation service
      const result = await translationService.translate(text, sourceLanguage, currentLanguage);

      if (result && result !== text) {
        console.log('[TranslationContext] Coordinated translation successful:', { 
          original: text.substring(0, 30), 
          translated: result.substring(0, 30) 
        });
        
        // Cache locally
        setTranslationCache(prev => ({ ...prev, [cacheKey]: result }));
        
        return result;
      }
      
      console.log('[TranslationContext] Coordinated translation returned same text, using original');
      return text;
    } catch (error) {
      console.error('[TranslationContext] Coordinated translation failed:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [currentLanguage, translationCache]);

  // FIXED: Make getCachedTranslation synchronous by only checking local cache
  const getCachedTranslation = useCallback((text: string): string | null => {
    const cacheKey = `${text}_en_${currentLanguage}`;
    const localCache = translationCache[cacheKey];
    
    console.log('[TranslationContext] Checking local cache for:', text.substring(0, 30), 
      { localCache: !!localCache });
    return localCache || null;
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
        // ENHANCED: Use Supabase edge function with proper source language
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: textsToTranslate,
            sourceLanguage: 'en',
            targetLanguage: currentLanguage,
            cleanResult: true
          }
        });

        if (!error && data && data.translatedTexts) {
          console.log(`[TranslationContext] Prefetched ${data.translatedTexts.length} translations for route ${route}`);
          
          // Cache the results
          textsToTranslate.forEach((originalText, index) => {
            const translatedText = data.translatedTexts[index];
            if (translatedText) {
              const cacheKey = `${originalText}_en_${currentLanguage}`;
              setTranslationCache(prev => ({ ...prev, [cacheKey]: translatedText }));
              onDemandTranslationCache.set(currentLanguage, originalText, translatedText);
            }
          });
        }
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
    clearCache: useCallback(async () => {
      console.log('[TranslationContext] APP-LEVEL: Clearing all coordinated translation caches');
      setTranslationCache({});
      onDemandTranslationCache.clearAll();
      EnhancedSoulNetPreloadService.clearInstantCache();
      SoulNetPreloadService.clearCache();
      // ENHANCED: Clear coordinated translation service cache
      await translationService.clearLanguageCache(currentLanguage);
    }, [currentLanguage]),
    getCachedTranslation,
    translationProgress: isTranslating ? 50 : 100,
    prefetchTranslationsForRoute,
    prefetchSoulNetTranslations,
    isSoulNetTranslating
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
