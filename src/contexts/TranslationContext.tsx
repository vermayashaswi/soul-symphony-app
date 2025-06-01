import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translationCache } from '@/services/translationCache';
import { toast } from 'sonner';
import { staticTranslationService } from '@/services/staticTranslationService';
import { preloadWebsiteTranslations } from '@/utils/website-translations';
import { useLocation } from 'react-router-dom';
import { fontService } from '@/utils/fontService';

// Define the comprehensive language options
export const languages = [
  // Currently implemented languages
  { code: 'en', label: 'English', region: 'European' },
  { code: 'es', label: 'Español', region: 'European' },
  { code: 'fr', label: 'Français', region: 'European' },
  { code: 'de', label: 'Deutsch', region: 'European' },
  { code: 'hi', label: 'हिन्दी', region: 'Indian' },
  { code: 'zh', label: '中文', region: 'Asian' },
  { code: 'ja', label: '日本語', region: 'Asian' },
  { code: 'ru', label: 'Русский', region: 'European' },
  { code: 'ar', label: 'العربية', region: 'Middle Eastern' },
  { code: 'pt', label: 'Português', region: 'European' },

  // Additional Indian regional languages
  { code: 'bn', label: 'বাংলা', region: 'Indian' },
  { code: 'ta', label: 'தமிழ்', region: 'Indian' },
  { code: 'te', label: 'తెలుగు', region: 'Indian' },
  { code: 'mr', label: 'मराठी', region: 'Indian' },
  { code: 'gu', label: 'ગુજરાતી', region: 'Indian' },
  { code: 'kn', label: 'ಕನ್ನಡ', region: 'Indian' },
  { code: 'ml', label: 'മലയാളം', region: 'Indian' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', region: 'Indian' },
  { code: 'as', label: 'অসমীয়া', region: 'Indian' },
  { code: 'or', label: 'ଓଡ଼ିଆ', region: 'Indian' },
  { code: 'ur', label: 'اردو', region: 'Indian' },
  { code: 'sd', label: 'سنڌي', region: 'Indian' },
  { code: 'ks', label: 'कॉशुर', region: 'Indian' },
  { code: 'kok', label: 'कोंकणी', region: 'Indian' },
  { code: 'mai', label: 'मैथिली', region: 'Indian' },

  // Other major global languages
  { code: 'it', label: 'Italiano', region: 'European' },
  { code: 'ko', label: '한국어', region: 'Asian' },
  { code: 'tr', label: 'Türkçe', region: 'European' },
  { code: 'nl', label: 'Nederlands', region: 'European' },
  { code: 'pl', label: 'Polski', region: 'European' },
  { code: 'sv', label: 'Svenska', region: 'European' },
  { code: 'th', label: 'ไทย', region: 'Asian' },
  { code: 'vi', label: 'Tiếng Việt', region: 'Asian' },
  { code: 'id', label: 'Bahasa Indonesia', region: 'Asian' },
  { code: 'uk', label: 'Українська', region: 'European' },
  { code: 'el', label: 'Ελληνικά', region: 'European' },
  { code: 'ro', label: 'Română', region: 'European' },
  { code: 'hu', label: 'Magyar', region: 'European' },
  { code: 'cs', label: 'Čeština', region: 'European' },
  { code: 'he', label: 'עברית', region: 'Middle Eastern' },
];

// Enhanced memory cache to prevent flickering
const memoryCache = new Map<string, string>();
const translationQueue = new Map<string, Promise<string>>();

interface TranslationContextType {
  isTranslating: boolean;
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
  translationProgress: number;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string>;
  getCachedTranslation: (text: string, language: string) => string | null;
  prefetchTranslationsForRoute: (routeTexts: string[]) => Promise<void>;
}

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
    if (language === 'en' || !text) return text;
    
    const cacheKey = createCacheKey(text, language);
    
    // Check memory cache first (fastest)
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey) || null;
    }
    
    return null;
  }, []);

  // Helper function to clean translation results
  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    
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
      
      const uniqueTexts = [...new Set(validTexts)];
      const textsToTranslate = uniqueTexts.filter(text => !getCachedTranslation(text, currentLanguage));
      
      if (textsToTranslate.length === 0) {
        return;
      }
      
      // Batch translate in groups of 20
      for (let i = 0; i < textsToTranslate.length; i += 20) {
        const batch = textsToTranslate.slice(i, i + 20);
        const batchTranslations = await staticTranslationService.batchTranslateTexts(batch);
        
        batchTranslations.forEach((translation, originalText) => {
          cacheTranslation(originalText, translation, currentLanguage);
        });
      }
      
      console.log(`Prefetching complete for ${textsToTranslate.length} texts`);
    } catch (error) {
      console.error('Error prefetching translations:', error);
    }
  }, [currentLanguage, getCachedTranslation, cacheTranslation]);

  // Monitor route changes
  useEffect(() => {
    const commonUIElements = ['Home', 'Blog', 'Settings', 'Profile', 'Logout', 'Download'];
    prefetchTranslationsForRoute(commonUIElements).catch(console.error);
  }, [location.pathname, prefetchTranslationsForRoute]);

  // Enhanced translate function with race condition prevention
  const translate = async (text: string, sourceLanguage?: string, entryId?: number): Promise<string> => {
    if (currentLanguage === 'en' || !text || text.trim() === '') return text;
    
    const cacheKey = createCacheKey(text, currentLanguage);
    
    // Check memory cache first
    const cachedTranslation = getCachedTranslation(text, currentLanguage);
    if (cachedTranslation) {
      return cachedTranslation;
    }
    
    // Check if translation is already in progress
    if (translationQueue.has(cacheKey)) {
      console.log(`[TranslationContext] Translation already in progress for: ${text.substring(0, 30)}...`);
      return translationQueue.get(cacheKey)!;
    }
    
    // Check persistent cache
    try {
      const cachedEntry = await translationCache.getTranslation(text, currentLanguage);
      if (cachedEntry) {
        cacheTranslation(text, cachedEntry.translatedText, currentLanguage);
        return cachedEntry.translatedText;
      }
    } catch (err) {
      console.error('Error checking translation cache:', err);
    }
    
    // Create new translation promise
    const translationPromise = (async () => {
      try {
        console.log(`[TranslationContext] Translating: "${text.substring(0, 30)}..." to ${currentLanguage}`);
        const translated = await staticTranslationService.translateText(text, sourceLanguage, entryId);
        
        const cleanedTranslation = cleanTranslationResult(translated);
        
        // Cache the result
        cacheTranslation(text, cleanedTranslation || text, currentLanguage);
        
        console.log(`[TranslationContext] Translation complete: "${cleanedTranslation?.substring(0, 30) || 'empty'}..."`);
        return cleanedTranslation || text;
      } catch (error) {
        console.error('[TranslationContext] Translation error:', error);
        return text;
      } finally {
        // Remove from queue when done
        translationQueue.delete(cacheKey);
      }
    })();
    
    // Add to queue
    translationQueue.set(cacheKey, translationPromise);
    
    return translationPromise;
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
      // Clear memory cache and translation queue when language changes
      memoryCache.clear();
      translationQueue.clear();
      console.log(`Cleared translation memory cache and queue`);
      
      // Store language preference
      localStorage.setItem('preferredLanguage', lang);
      
      // Update the HTML lang attribute
      updateHtmlLang(lang);
      
      // Update the service language
      staticTranslationService.setLanguage(lang);
      
      // Detect script type and preload fonts
      if (lang !== 'en') {
        const scriptType = fontService.detectScriptType('sample text for ' + lang);
        await fontService.preloadFontsForScript(scriptType);
      }
      
      // Set new language
      setCurrentLanguage(lang);
      
      // Preload common website translations for non-English languages
      if (lang !== 'en') {
        try {
          preloadWebsiteTranslations(lang).catch(err => {
            console.error('Failed to preload website translations:', err);
          });
        } catch (error) {
          console.error('Error preloading translations:', error);
        }
      }
      
      // Dispatch language change event
      window.dispatchEvent(new CustomEvent('languageChange', { 
        detail: { 
          language: lang,
          timestamp: Date.now()
        } 
      }));
      
      const selectedLang = languages.find(l => l.code === lang);
      toast.success(`Language changed to ${selectedLang?.label || lang}`);
      
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
      updateHtmlLang(storedLang);
      setLanguage(storedLang);
    } else {
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
