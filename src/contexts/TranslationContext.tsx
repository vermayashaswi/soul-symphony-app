
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translationCache } from '@/services/translationCache';
import { toast } from 'sonner';
import { staticTranslationService } from '@/services/staticTranslationService';
import { preloadWebsiteTranslations } from '@/utils/website-translations';
import { useLocation } from 'react-router-dom';

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

// Local memory cache to prevent flickering during navigation
const memoryCache = new Map<string, string>();

interface TranslationContextType {
  isTranslating: boolean;
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
  translationProgress: number;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  getCachedTranslation: (text: string, language: string) => string | null;
  prefetchTranslationsForRoute: (routeTexts: string[]) => Promise<void>;
}

// Create the context with undefined initial value
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translationProgress, setTranslationProgress] = useState(100);
  const location = useLocation();
  
  // Create a unique cache key
  const createCacheKey = (text: string, language: string): string => {
    return `${language}:${text.substring(0, 100)}`;
  };

  // Get cached translation from memory or IDB
  const getCachedTranslation = useCallback((text: string, language: string): string | null => {
    // Skip for English or empty text
    if (language === 'en' || !text) return text;
    
    // Create cache key
    const cacheKey = createCacheKey(text, language);
    
    // Check memory cache first (fastest)
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey) || null;
    }
    
    return null; // Will trigger a translation request
  }, []);

  // Helper function to clean translation results
  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    
    // Remove language code suffix like "(hi)" or "[hi]" that might be appended
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };

  // Helper to cache a translation in both memory and IDB
  const cacheTranslation = useCallback((text: string, translatedText: string, language: string): void => {
    if (!text || !translatedText || language === 'en') return;
    
    const cacheKey = createCacheKey(text, language);
    
    // Store in memory cache
    memoryCache.set(cacheKey, translatedText);
    
    // Also store in persistent cache
    translationCache.setTranslation({
      originalText: text,
      translatedText,
      language,
      timestamp: Date.now(),
      version: 1,
    }).catch(err => console.error('Failed to cache translation:', err));
  }, []);

  // Function to prefetch translations for a route
  const prefetchTranslationsForRoute = useCallback(async (routeTexts: string[]): Promise<void> => {
    if (currentLanguage === 'en' || !routeTexts.length) return;
    
    try {
      console.log(`Prefetching ${routeTexts.length} translations for route`);
      const validTexts = routeTexts.filter(text => text && typeof text === 'string' && text.trim() !== '');
      
      // Deduplicate texts to translate
      const uniqueTexts = [...new Set(validTexts)];
      const textsToTranslate = uniqueTexts.filter(text => !getCachedTranslation(text, currentLanguage));
      
      if (textsToTranslate.length === 0) {
        return; // All texts already cached
      }
      
      // Batch translate in groups of 20
      for (let i = 0; i < textsToTranslate.length; i += 20) {
        const batch = textsToTranslate.slice(i, i + 20);
        const batchTranslations = await staticTranslationService.batchTranslateTexts(batch);
        
        // Cache all results
        batchTranslations.forEach((translation, originalText) => {
          cacheTranslation(originalText, translation, currentLanguage);
        });
      }
      
      console.log(`Prefetching complete for ${textsToTranslate.length} texts`);
    } catch (error) {
      console.error('Error prefetching translations:', error);
    }
  }, [currentLanguage, getCachedTranslation, cacheTranslation]);

  // Monitor route changes to load route-specific translations
  useEffect(() => {
    // When the route changes, we can prefetch translations for common UI elements
    const commonUIElements = ['Home', 'Blog', 'Settings', 'Profile', 'Logout', 'Download'];
    prefetchTranslationsForRoute(commonUIElements).catch(console.error);
  }, [location.pathname, prefetchTranslationsForRoute]);

  // Function to translate text using our service
  const translate = async (text: string, sourceLanguage?: string, entryId?: number): Promise<string> => {
    if (currentLanguage === 'en' || !text || text.trim() === '') return text;
    
    // Check memory cache first
    const cachedTranslation = getCachedTranslation(text, currentLanguage);
    if (cachedTranslation) {
      return cachedTranslation;
    }
    
    // Then check persistent cache
    try {
      const cachedEntry = await translationCache.getTranslation(text, currentLanguage);
      if (cachedEntry) {
        // Store in memory cache for faster access next time
        cacheTranslation(text, cachedEntry.translatedText, currentLanguage);
        return cachedEntry.translatedText;
      }
    } catch (err) {
      console.error('Error checking translation cache:', err);
    }
    
    try {
      console.log(`Translating text: "${text.substring(0, 30)}..." to ${currentLanguage} from ${sourceLanguage || 'en'}${entryId ? ` for entry ${entryId}` : ''}`);
      const translated = await staticTranslationService.translateText(text, sourceLanguage, entryId);
      
      // Clean the result in case the service didn't do it
      const cleanedTranslation = cleanTranslationResult(translated);
      
      // Cache the result for future use
      cacheTranslation(text, cleanedTranslation || text, currentLanguage);
      
      console.log(`Translation result: "${cleanedTranslation?.substring(0, 30) || 'empty'}..."`);
      return cleanedTranslation || text;
    } catch (error) {
      console.error('Translation error in context:', error);
      return text; // Fallback to original
    }
  };

  // Set the HTML document language attribute
  const updateHtmlLang = (lang: string) => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-language', lang);
    console.log(`TranslationContext: Updated HTML lang attribute to ${lang}`);
  };

  const setLanguage = async (lang: string) => {
    if (lang === currentLanguage) return;
    
    console.log(`Changing language from ${currentLanguage} to ${lang}`);
    setIsTranslating(true);
    setTranslationProgress(0);
    
    try {
      // Clear memory cache when language changes
      memoryCache.clear();
      console.log(`Cleared translation memory cache`);
      
      // Store language preference
      localStorage.setItem('preferredLanguage', lang);
      
      // Update the HTML lang attribute
      updateHtmlLang(lang);
      
      // Update the service language
      staticTranslationService.setLanguage(lang);
      
      // Set new language
      setCurrentLanguage(lang);
      
      // If changing to a non-English language, preload common website translations
      if (lang !== 'en') {
        try {
          // Preload common website translations in the background
          preloadWebsiteTranslations(lang).catch(err => {
            console.error('Failed to preload website translations:', err);
          });
        } catch (error) {
          console.error('Error preloading translations:', error);
        }
      }
      
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
        setIsTranslating(false);
      }, 300);
    } catch (error) {
      console.error('Language change error:', error);
      toast.error('Failed to change language');
      setIsTranslating(false);
    }
  };

  // Initialize with stored preference
  useEffect(() => {
    const storedLang = localStorage.getItem('preferredLanguage');
    if (storedLang) {
      console.log(`Initializing with stored language preference: ${storedLang}`);
      // Set HTML lang attribute immediately
      updateHtmlLang(storedLang);
      setLanguage(storedLang);
    } else {
      // Ensure HTML lang is set to default
      updateHtmlLang('en');
    }
  }, []);

  return (
    <TranslationContext.Provider value={{ 
      isTranslating, 
      currentLanguage, 
      setLanguage,
      translationProgress,
      translate,
      getCachedTranslation,
      prefetchTranslationsForRoute
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
