
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { SoulNetPreloadService } from '@/services/soulnetPreloadService';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { translationService } from '@/services/translationService';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

// INJECTED: Helper to detect if a route is a marketing page
const websitePrefixes = [
  '/', '/about', '/pricing', '/terms', '/privacy', '/blog', '/contact', '/faq', '/download'
];
export function isWebsiteRoute(pathname: string): boolean {
  // '/' is marketing, '/app' is not; everything else in websitePrefixes is marketing.
  if (pathname.startsWith('/app')) return false;
  if (pathname === '/') return true;
  return websitePrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

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
  // ENHANCED: Context now always tracks current pathname to trigger correct language behavior
  const location = typeof window !== "undefined" ? window.location : { pathname: "/" };
  const [currentPath, setCurrentPath] = useState<string>(location.pathname);
  // State determining if we are currently in the website (marketing)
  const [onMarketing, setOnMarketing] = useState<boolean>(isWebsiteRoute(location.pathname));

  // Force language to 'en' if on marketing
  const [currentLanguage, setCurrentLanguageState] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isSoulNetTranslating, setIsSoulNetTranslating] = useState<boolean>(false);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});

  // This ensures that any attempt to set language on homepage will revert to English
  useEffect(() => {
    // Listen for path changes and update marketing/app status
    const syncMarketingMode = () => {
      const newPath = window.location.pathname;
      setCurrentPath(newPath);
      const nowMarketing = isWebsiteRoute(newPath);
      setOnMarketing(nowMarketing);

      // IF ON MARKETING, always set to English. If on app, restore saved or browser language.
      if (nowMarketing) {
        setCurrentLanguageState('en');
      } else {
        let loadedLang = 'en';
        try {
          const savedLanguage = localStorage.getItem('soulo-language');
          if (savedLanguage) loadedLang = savedLanguage;
        } catch { }
        // Fallback to browser on first visit to app section
        if (!loadedLang || loadedLang === 'en') {
          const browserLanguage = navigator.language?.split('-')[0] ?? 'en';
          const supportedLanguages = [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'hi', 'ar', 'bn',
            'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'
          ];
          if (supportedLanguages.includes(browserLanguage)) {
            loadedLang = browserLanguage;
          }
        }
        setCurrentLanguageState(loadedLang);
      }
    };

    // Handle popstate/navigation events (also works with react-router, but is bulletproof for preview)
    window.addEventListener('popstate', syncMarketingMode);
    window.addEventListener('pushstate', syncMarketingMode); // Custom events, may not always fire
    window.addEventListener('replacestate', syncMarketingMode);
    window.addEventListener('locationchange', syncMarketingMode);

    // React-router v6 workaround: observe path with polling
    const interval = setInterval(() => {
      if (window.location.pathname !== currentPath) {
        syncMarketingMode();
      }
    }, 300);

    syncMarketingMode();

    return () => {
      window.removeEventListener('popstate', syncMarketingMode);
      window.removeEventListener('pushstate', syncMarketingMode);
      window.removeEventListener('replacestate', syncMarketingMode);
      window.removeEventListener('locationchange', syncMarketingMode);
      clearInterval(interval);
    };
  // Only depend on actual window location, not react-router location
  // eslint-disable-next-line
  }, [typeof window !== "undefined" ? window.location.pathname : "/", currentPath]);

  // The only way to change the language via selection, only possible in the app
  const handleLanguageChange = useCallback(async (language: string) => {
    if (onMarketing) {
      setCurrentLanguageState('en');
      localStorage.setItem('soulo-language', 'en');
      return;
    }
    setCurrentLanguageState(language);
    localStorage.setItem('soulo-language', language);

    // Translation caches always cleared as before
    EnhancedSoulNetPreloadService.clearInstantCache();
    SoulNetPreloadService.clearCache();
    const event = new CustomEvent('languageChange', { 
      detail: { language, isSoulNetTranslating: language !== 'en' }
    });
    window.dispatchEvent(event);
    setIsSoulNetTranslating(language !== 'en');
  }, [onMarketing]);

  // Shorter prefetch for SoulNet
  const prefetchSoulNetTranslations = useCallback(async (userId: string, timeRange: string): Promise<void> => {
    if (onMarketing || currentLanguage === 'en') return;
    setIsSoulNetTranslating(true);
    try {
      await EnhancedSoulNetPreloadService.preloadInstantData(userId, timeRange, currentLanguage);
    } catch {}
    setIsSoulNetTranslating(false);
  }, [currentLanguage, onMarketing]);

  // Critically, translation requests should return immediately if on marketing or English
  const translate = useCallback(async (text: string, sourceLanguage: string = 'en', entryId?: number): Promise<string | null> => {
    if (!text || typeof text !== 'string') return text || '';
    // On marketing pages, always return English text -- DO NOT TRANSLATE.
    if (onMarketing || currentLanguage === 'en') {
      return text;
    }
    // App routes only:
    const cacheKey = `${text}_${sourceLanguage}_${currentLanguage}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];
    const cachedTranslation = onDemandTranslationCache.get(currentLanguage, text);
    if (cachedTranslation) {
      setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
      return cachedTranslation;
    }
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text,
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
          targetLanguage: currentLanguage,
          entryId,
          cleanResult: true
        }
      });
      if (!error && data && data.translatedText && data.translatedText !== text) {
        setTranslationCache(prev => ({ ...prev, [cacheKey]: data.translatedText }));
        onDemandTranslationCache.set(currentLanguage, text, data.translatedText);
        return data.translatedText;
      }
      return text;
    } catch (error) {
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [currentLanguage, translationCache, onMarketing]);

  const getCachedTranslation = useCallback((text: string): string | null => {
    if (onMarketing || currentLanguage === 'en') return null;
    const cacheKey = `${text}_en_${currentLanguage}`;
    const localCache = translationCache[cacheKey];
    const onDemandCache = onDemandTranslationCache.get(currentLanguage, text);
    return localCache || onDemandCache || null;
  }, [currentLanguage, translationCache, onMarketing]);
  
  const prefetchTranslationsForRoute = useCallback(async (route: string): Promise<void> => {
    if (onMarketing || currentLanguage === 'en') return;
    const routeTexts = {
      '/': ['Home', 'Download on App Store', 'Your Voice, Your Journey'],
      '/insights': ['Insights', 'Discover patterns', 'Soul-Net Visualization', 'Dominant Mood'],
      '/journal': ['Journal', 'New Entry', 'Search', 'Recent Entries']
    };
    const textsToTranslate = routeTexts[route] || [];
    if (textsToTranslate.length > 0) {
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: {
            texts: textsToTranslate,
            sourceLanguage: 'en',
            targetLanguage: currentLanguage,
            cleanResult: true
          }
        });
        if (!error && data && data.translatedTexts) {
          textsToTranslate.forEach((originalText, index) => {
            const translatedText = data.translatedTexts[index];
            if (translatedText) {
              const cacheKey = `${originalText}_en_${currentLanguage}`;
              setTranslationCache(prev => ({ ...prev, [cacheKey]: translatedText }));
              onDemandTranslationCache.set(currentLanguage, originalText, translatedText);
            }
          });
        }
      } catch {}
    }
  }, [currentLanguage, onMarketing]);

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
    // Fix: translationProgress is always 100 to disable global overlay
    translationProgress: 100,
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

