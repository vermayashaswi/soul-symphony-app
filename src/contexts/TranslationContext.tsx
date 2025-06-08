
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { translationStateManager } from '@/services/translationStateManager';

interface TranslationContextType {
  currentLanguage: string;
  setLanguage: (language: string) => Promise<void>;
  translate: ((text: string, sourceLanguage?: string) => Promise<string>) | null;
  isTranslating: boolean;
  getCachedTranslation: (text: string) => string | null;
  translationProgress: number;
  translationError: Error | null;
  isSoulNetTranslating: boolean;
  prefetchSoulNetTranslations: (userId: string, timeRange: string) => Promise<void>;
  prefetchTranslationsForRoute: (route: string) => Promise<void>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSoulNetTranslating, setIsSoulNetTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translationError, setTranslationError] = useState<Error | null>(null);
  const translateFunctionRef = useRef<((text: string, sourceLanguage?: string) => Promise<string>) | null>(null);

  // INTEGRATION: Connect to translation state manager
  useEffect(() => {
    const unsubscribe = translationStateManager.addListener({
      onStateChange: (state) => {
        console.log('[TranslationContext] COORDINATED: State change received:', state);
        setCurrentLanguage(state.language);
        setIsTranslating(state.loading);
        setIsSoulNetTranslating(state.loading);
        setTranslationProgress(state.progress);
        setTranslationError(state.error);
      },
      onError: (error) => {
        console.error('[TranslationContext] COORDINATED: Translation error:', error);
        setTranslationError(error);
        setIsTranslating(false);
        setIsSoulNetTranslating(false);
      },
      onComplete: (language) => {
        console.log('[TranslationContext] COORDINATED: Translation complete for:', language);
        setIsTranslating(false);
        setIsSoulNetTranslating(false);
        setTranslationProgress(100);
        setTranslationError(null);
      }
    });

    return unsubscribe;
  }, []);

  // COORDINATED LANGUAGE CHANGE: Use translation state manager
  const setLanguage = useCallback(async (language: string) => {
    if (language === currentLanguage) {
      console.log('[TranslationContext] COORDINATED: Language already set to', language);
      return;
    }

    console.log('[TranslationContext] COORDINATED: Setting language to', language, 'for user', user?.id);
    
    try {
      await translationStateManager.coordinateLanguageChange(language, user?.id);
      
      // Store language preference
      localStorage.setItem('preferred-language', language);
      
      console.log('[TranslationContext] COORDINATED: Successfully set language to', language);
    } catch (error) {
      console.error('[TranslationContext] COORDINATED: Failed to set language:', error);
      
      // Attempt recovery
      try {
        await translationStateManager.recoverFromTranslationFailure(language, user?.id);
      } catch (recoveryError) {
        console.error('[TranslationContext] COORDINATED: Recovery failed:', recoveryError);
        setTranslationError(recoveryError instanceof Error ? recoveryError : new Error('Language change failed'));
      }
    }
  }, [currentLanguage, user?.id]);

  // Initialize translation function
  useEffect(() => {
    const initializeTranslateFunction = async () => {
      if (typeof window !== 'undefined' && window.google?.translate) {
        console.log('[TranslationContext] COORDINATED: Google Translate is available');
        
        const translateFunction = async (text: string, sourceLanguage: string = 'en'): Promise<string> => {
          if (!text || currentLanguage === sourceLanguage) {
            return text;
          }

          try {
            return new Promise((resolve, reject) => {
              const element = document.createElement('div');
              element.innerHTML = text;
              element.style.display = 'none';
              document.body.appendChild(element);

              const translateElement = new window.google.translate.TranslateElement({
                pageLanguage: sourceLanguage,
                includedLanguages: currentLanguage,
                autoDisplay: false
              }, element);

              // Simplified translation logic for demonstration
              // In practice, you'd integrate with the actual Google Translate API
              setTimeout(() => {
                const translatedText = text; // Placeholder - implement actual translation
                document.body.removeChild(element);
                resolve(translatedText);
              }, 100);
            });
          } catch (error) {
            console.error('[TranslationContext] COORDINATED: Translation error:', error);
            return text; // Fallback to original text
          }
        };

        translateFunctionRef.current = translateFunction;
      } else {
        console.log('[TranslationContext] COORDINATED: Google Translate not available, using fallback');
        translateFunctionRef.current = async (text: string) => text;
      }
    };

    initializeTranslateFunction();
  }, [currentLanguage]);

  // Load saved language preference
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && savedLanguage !== currentLanguage) {
      console.log('[TranslationContext] COORDINATED: Loading saved language preference:', savedLanguage);
      setLanguage(savedLanguage);
    }
  }, []);

  // Simple cache implementation for demonstration - return string directly
  const getCachedTranslation = useCallback((text: string): string | null => {
    // This would integrate with the actual cache in a real implementation
    return null;
  }, []);

  // Prefetch SoulNet translations
  const prefetchSoulNetTranslations = useCallback(async (userId: string, timeRange: string): Promise<void> => {
    console.log('[TranslationContext] Prefetching SoulNet translations for:', userId, timeRange);
    // Implementation would go here
  }, []);

  // Prefetch translations for a route
  const prefetchTranslationsForRoute = useCallback(async (route: string): Promise<void> => {
    console.log('[TranslationContext] Prefetching translations for route:', route);
    // Implementation would go here
  }, []);

  const contextValue: TranslationContextType = {
    currentLanguage,
    setLanguage,
    translate: translateFunctionRef.current,
    isTranslating,
    getCachedTranslation,
    translationProgress,
    translationError,
    isSoulNetTranslating,
    prefetchSoulNetTranslations,
    prefetchTranslationsForRoute
  };

  return (
    <TranslationContext.Provider value={contextValue}>
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
