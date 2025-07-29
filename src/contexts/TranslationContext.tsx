
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { translationService } from '@/services/translationService';
import { supabase } from '@/integrations/supabase/client';

interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  setLanguage: (language: string) => void; // Alias for backwards compatibility
  translate: (text: string, sourceLanguage?: string, entryId?: number, forceTranslate?: boolean) => Promise<string | null>;
  isTranslating: boolean;
  clearCache: () => void;
  getCachedTranslation: (text: string) => string | null;
  translationProgress?: number;
  prefetchTranslationsForRoute?: (route: string) => Promise<void>;
  setTestLanguageForDevelopment?: (language: string | null) => void; // For development testing
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});
  
  // Development mode for testing translations
  const isDevelopmentMode = process.env.NODE_ENV === 'development';
  
  // Add a way to temporarily override language for testing
  const [testLanguageOverride, setTestLanguageOverride] = useState<string | null>(() => {
    return isDevelopmentMode ? localStorage.getItem('testLanguageOverride') : null;
  });
  
  const effectiveLanguage = testLanguageOverride || currentLanguage;


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


  const handleLanguageChange = useCallback(async (language: string) => {
    console.log('[TranslationContext] 🌍 LANGUAGE CHANGE INITIATED:', { 
      from: currentLanguage, 
      to: language, 
      timestamp: new Date().toISOString() 
    });
    
    // IMMEDIATE STATE UPDATE - Use functional update to ensure immediate consistency
    setCurrentLanguage((prevLang) => {
      console.log('[TranslationContext] 🔄 STATE UPDATE:', { prevLang, newLang: language });
      return language;
    });
    
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('soulo-language', language);
      console.log('[TranslationContext] 💾 Saved language to localStorage:', language);
    } catch (error) {
      console.error('[TranslationContext] ❌ Error saving language to localStorage:', error);
    }
    
    // Clear translation caches immediately
    setTranslationCache({});
    onDemandTranslationCache.clearAll();
    
    console.log('[TranslationContext] 🧹 Cleared all translation caches for language:', language);
    
    // Dispatch custom event with immediate language value
    const event = new CustomEvent('languageChange', { 
      detail: { 
        language,
        previousLanguage: currentLanguage,
        
        timestamp: Date.now()
      } 
    });
    
    // Use setTimeout to ensure state has propagated before event dispatch
    setTimeout(() => {
      console.log('[TranslationContext] 📢 Dispatching languageChange event:', { language });
      window.dispatchEvent(event);
    }, 0);
    
    
    console.log('[TranslationContext] ✅ Language change completed:', language);
  }, [currentLanguage]);

  const translate = useCallback(async (text: string, sourceLanguage: string = 'en', entryId?: number, forceTranslate: boolean = false): Promise<string | null> => {
    if (!text || typeof text !== 'string') {
      console.warn('[TranslationContext] ⚠️ Invalid text provided for translation:', text);
      return text || '';
    }

    const currentTargetLang = effectiveLanguage;
    
    console.log('[TranslationContext] 🔍 TRANSLATION REQUEST:', { 
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
      sourceLanguage, 
      targetLanguage: currentTargetLang,
      effectiveLanguage,
      currentLanguage,
      testOverride: testLanguageOverride,
      forceTranslate,
      entryId,
      timestamp: new Date().toISOString()
    });

    // Skip translation only if languages match AND forceTranslate is false
    if (currentTargetLang === sourceLanguage && !forceTranslate) {
      console.log('[TranslationContext] ⏭️ SKIPPING TRANSLATION - Same language:', { 
        text: text.substring(0, 30), 
        lang: currentTargetLang, 
        forceTranslate 
      });
      return text;
    }

    // Development mode override for testing
    if (forceTranslate && currentTargetLang === sourceLanguage) {
      console.log('[TranslationContext] 🧪 FORCE TRANSLATE ENABLED for testing:', { 
        text: text.substring(0, 30), 
        targetLang: currentTargetLang 
      });
    }

    const cacheKey = `${text}_${sourceLanguage}_${effectiveLanguage}`;
    
    // Check local cache first
    if (translationCache[cacheKey]) {
      console.log('[TranslationContext] Using local cache for:', text.substring(0, 30));
      return translationCache[cacheKey];
    }

    // Check on-demand cache
    const cachedTranslation = onDemandTranslationCache.get(effectiveLanguage, text);
    if (cachedTranslation) {
      console.log('[TranslationContext] Using on-demand cache for:', text.substring(0, 30));
      setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
      return cachedTranslation;
    }

    try {
      setIsTranslating(true);
      
      console.log('[TranslationContext] Using Supabase edge function for translation');
      
      // ENHANCED: Use Supabase edge function with proper source language handling
      const payload = {
        text,
        sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
        targetLanguage: currentTargetLang,
        entryId,
        cleanResult: true,
        forceTranslate
      };
      
      console.log('[TranslationContext] 📤 CALLING EDGE FUNCTION with payload:', payload);
      
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: payload
      });

      console.log('[TranslationContext] 📥 EDGE FUNCTION RESPONSE:', { 
        hasError: !!error, 
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        error 
      });

      if (error) {
        console.error('[TranslationContext] ❌ EDGE FUNCTION ERROR:', error);
        return text;
      }

      if (data && data.translatedText && data.translatedText !== text) {
        const translatedText = data.translatedText;
        console.log('[TranslationContext] ✅ TRANSLATION SUCCESSFUL:', { 
          original: text.substring(0, 50), 
          translated: translatedText.substring(0, 50),
          targetLang: currentTargetLang
        });
        
        // Cache both locally and in on-demand cache
        const newCacheKey = `${text}_${sourceLanguage}_${currentTargetLang}`;
        setTranslationCache(prev => ({ ...prev, [newCacheKey]: translatedText }));
        onDemandTranslationCache.set(currentTargetLang, text, translatedText);
        
        return translatedText;
      }
      
      console.log('[TranslationContext] ⚠️ TRANSLATION RETURNED SAME TEXT, using original:', {
        originalText: text.substring(0, 30),
        returnedText: data?.translatedText?.substring(0, 30)
      });
      return text;
    } catch (error) {
      console.error('[TranslationContext] Translation failed:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [effectiveLanguage, translationCache]);

  const getCachedTranslation = useCallback((text: string): string | null => {
    const cacheKey = `${text}_en_${effectiveLanguage}`;
    const localCache = translationCache[cacheKey];
    const onDemandCache = onDemandTranslationCache.get(effectiveLanguage, text);
    console.log('[TranslationContext] Checking cache for:', text.substring(0, 30), 
      { localCache: !!localCache, onDemandCache: !!onDemandCache, effectiveLanguage });
    return localCache || onDemandCache || null;
  }, [effectiveLanguage, translationCache]);
  
  // Development helper for testing translations
  const setTestLanguageForDevelopment = useCallback((language: string | null) => {
    if (isDevelopmentMode) {
      setTestLanguageOverride(language);
      if (language) {
        localStorage.setItem('testLanguageOverride', language);
      } else {
        localStorage.removeItem('testLanguageOverride');
      }
      console.log('[TranslationContext] Development mode: Set test language override to:', language);
    }
  }, [isDevelopmentMode]);

  const prefetchTranslationsForRoute = useCallback(async (route: string): Promise<void> => {
    console.log(`[TranslationContext] Prefetching translations for route: ${route}`);
    // Get common route texts for prefetching - can be expanded
    const routeTexts = {
      '/': ['Home', 'Download on App Store', 'Your Voice, Your Journey'],
      '/insights': ['Insights', 'Discover patterns', 'Dominant Mood'],
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
    currentLanguage: effectiveLanguage, // Use effectiveLanguage to include test override
    setCurrentLanguage: handleLanguageChange,
    setLanguage: handleLanguageChange, // Alias for backwards compatibility
    translate,
    isTranslating,
    clearCache: useCallback(() => {
      console.log('[TranslationContext] APP-LEVEL: Clearing all translation caches');
      setTranslationCache({});
      onDemandTranslationCache.clearAll();
    }, []),
    getCachedTranslation,
    translationProgress: isTranslating ? 50 : 100,
    prefetchTranslationsForRoute,
    setTestLanguageForDevelopment
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

// Development helper - expose to global scope for testing
if (process.env.NODE_ENV === 'development') {
  (window as any).debugTranslation = {
    testLanguage: (language: string | null) => {
      console.log('🧪 [DevTools] Setting test language override to:', language);
      const event = new CustomEvent('devTestLanguageChange', { detail: { language } });
      window.dispatchEvent(event);
    },
    forceTranslate: (text: string, targetLang: string = 'es') => {
      console.log('🧪 [DevTools] Force translating:', { text, targetLang });
      // This will be implemented to directly call the translate function
    },
    showHelp: () => {
      console.log('🧪 [DevTools] Translation Debug Commands:');
      console.log('debugTranslation.testLanguage("es") // Set test language to Spanish'); 
      console.log('debugTranslation.testLanguage(null) // Remove override');
      console.log('debugTranslation.forceTranslate("Hello", "es") // Test direct translation');
      console.log('debugTranslation.showState() // Show current translation state');
    },
    showState: () => {
      console.log('🧪 [DevTools] Current Translation State:', {
        currentLanguage: localStorage.getItem('soulo-language'),
        testOverride: localStorage.getItem('testLanguageOverride'),
        recentLanguages: localStorage.getItem('recentLanguages')
      });
    }
  };
  
  // Auto-show help on load
  console.log('🧪 Translation Debug Mode Active - Type debugTranslation.showHelp() for commands');
}
