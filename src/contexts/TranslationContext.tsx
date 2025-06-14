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
    console.log('[TranslationContext] APP-LEVEL: Setting up translation service integration');
    
    // Register translation service with EnhancedSoulNetPreloadService
    EnhancedSoulNetPreloadService.setAppLevelTranslationService(translationService);
    
    console.log('[TranslationContext] APP-LEVEL: Translation service integration complete');
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
      
      // ENHANCED: Use enhanced preload service for better translation coordination
      await EnhancedSoulNetPreloadService.preloadInstantData(userId, timeRange, currentLanguage);
      
      console.log('[TranslationContext] APP-LEVEL: SoulNet pre-translation completed successfully');
    } catch (error) {
      console.error('[TranslationContext] APP-LEVEL: Error pre-translating SoulNet data:', error);
    } finally {
      setIsSoulNetTranslating(false);
    }
  }, [currentLanguage]);

  /**
   * Handle language change:
   * Add `previousLanguage` to custom event for downstream cache management.
   */
  const handleLanguageChange = useCallback(async (language: string) => {
    const previousLanguage = currentLanguage;
    // ... keep existing code (pre: setIsSoulNetTranslating, setCurrentLanguage) the same ...
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
    
    // ENHANCED: Clear both enhanced and legacy SoulNet caches when language changes
    EnhancedSoulNetPreloadService.clearInstantCache();
    SoulNetPreloadService.clearCache();
    
    console.log('[TranslationContext] APP-LEVEL: Cleared all SoulNet caches for language change');
    
    // Dispatch custom event with `previousLanguage` included
    const event = new CustomEvent('languageChange', { 
      detail: { 
        language,
        previousLanguage, // Add previousLanguage so hooks can clear old cache
        isSoulNetTranslating: language !== 'en'
      } 
    });
    window.dispatchEvent(event);

    if (language === 'en') {
      setIsSoulNetTranslating(false);
    }
  }, [currentLanguage]);

  /**
   * Return the best immediately-available translation (local state or on-demand cache).
   * (This method is always synchronous and doesn't modify state!)
   */
  const getCachedTranslation = useCallback((text: string): string | null => {
    const cacheKey = `${text}_en_${currentLanguage}`;
    // Always check local cache synchronously first
    const localCache = translationCache[cacheKey];
    // Always check on-demand cache second (may be more up to date)
    const onDemandCache = onDemandTranslationCache.get(currentLanguage, text);
    // If local cache exists, return it; otherwise check on-demand cache
    return localCache || onDemandCache || null;
  }, [currentLanguage, translationCache]);

  /**
   * Main async translation method. Only call if not cached.
   * This may update the cache for future instant access.
   */
  const translate = useCallback(async (text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string | null> => {
    if (!text || typeof text !== 'string') return text || '';
    if (currentLanguage === sourceLanguage) return text;

    const cacheKey = `${text}_${sourceLanguage}_${currentLanguage}`;
    // **Before anything, check full cache and return immediately if hit!**
    // -- this ensures all translation consumers get instant match and don't re-request from server
    if (translationCache[cacheKey]) return translationCache[cacheKey];
    const cachedTranslation = onDemandTranslationCache.get(currentLanguage, text);
    if (cachedTranslation) {
      setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
      return cachedTranslation;
    }

    try {
      setIsTranslating(true);
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
          targetLanguage: currentLanguage,
          entryId,
          cleanResult: true
        }
      });
      if (error) return text;
      if (data && data.translatedText && data.translatedText !== text) {
        const translatedText = data.translatedText;
        setTranslationCache(prev => ({ ...prev, [cacheKey]: translatedText }));
        onDemandTranslationCache.set(currentLanguage, text, translatedText);
        return translatedText;
      }
      return text;
    } catch (error) {
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [currentLanguage, translationCache]);

  const value: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage: handleLanguageChange,
    setLanguage: handleLanguageChange,
    translate,
    isTranslating,
    clearCache: useCallback(() => {
      setTranslationCache({});
      onDemandTranslationCache.clearAll();
      EnhancedSoulNetPreloadService.clearInstantCache();
      SoulNetPreloadService.clearCache();
    }, []),
    getCachedTranslation,
    translationProgress: isTranslating ? 50 : 100,
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
