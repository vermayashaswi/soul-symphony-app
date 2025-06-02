
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { fontService } from '@/utils/fontService';

interface SafeContextType {
  currentLanguage: string;
  translate: ((text: string) => Promise<string>) | null;
  isTranslationReady: boolean;
  isFontReady: boolean;
}

const SafeContext = createContext<SafeContextType>({
  currentLanguage: 'en',
  translate: null,
  isTranslationReady: false,
  isFontReady: false
});

export const useSafeTranslation = () => {
  return useContext(SafeContext);
};

interface ContextSafetyWrapperProps {
  children: React.ReactNode;
}

export const ContextSafetyWrapper: React.FC<ContextSafetyWrapperProps> = ({ children }) => {
  const [isTranslationReady, setIsTranslationReady] = useState(false);
  const [isFontReady, setIsFontReady] = useState(false);
  
  // Safely access translation context
  let translationContext;
  try {
    translationContext = useTranslation();
  } catch (error) {
    console.warn('[ContextSafetyWrapper] Translation context not available:', error);
    translationContext = null;
  }

  const currentLanguage = translationContext?.currentLanguage || 'en';
  const translate = translationContext?.translate || null;

  // Initialize font service
  useEffect(() => {
    const initializeFonts = async () => {
      try {
        await fontService.waitForFonts();
        setIsFontReady(true);
        console.log('[ContextSafetyWrapper] Fonts initialized successfully');
      } catch (error) {
        console.warn('[ContextSafetyWrapper] Font initialization failed:', error);
        setIsFontReady(true); // Don't block on font errors
      }
    };

    initializeFonts();
  }, []);

  // Monitor translation readiness
  useEffect(() => {
    if (translationContext) {
      setIsTranslationReady(true);
      console.log('[ContextSafetyWrapper] Translation context ready');
    } else {
      // Fallback for missing context
      const timer = setTimeout(() => {
        setIsTranslationReady(true);
        console.log('[ContextSafetyWrapper] Using fallback translation state');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [translationContext]);

  const safeContextValue: SafeContextType = {
    currentLanguage,
    translate,
    isTranslationReady,
    isFontReady
  };

  return (
    <SafeContext.Provider value={safeContextValue}>
      {children}
    </SafeContext.Provider>
  );
};

export default ContextSafetyWrapper;
