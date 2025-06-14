import React, { createContext, useContext, ReactNode } from 'react';

// Minimal type for the context, ensuring essential properties are present
interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void; // For consistency with original, though setLanguage is often used
  setLanguage: (language: string) => void;
  translate: (text: string, sourceLanguage?: string, entryId?: number) => Promise<string | null>;
  isTranslating: boolean;
  clearCache: () => void;
  getCachedTranslation: (text: string) => string | null;
  translationProgress?: number; // Optional as in original
  prefetchTranslationsForRoute?: (route: string) => Promise<void>; // Optional
  prefetchSoulNetTranslations: (userId: string, timeRange: string) => Promise<void>;
  isSoulNetTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  // Using React.useState explicitly. This will be around line 31.
  const [currentLanguage, setCurrentLanguageInternal] = React.useState<string>('en');
  const [isTranslating, setIsTranslatingInternal] = React.useState<boolean>(false);
  const [isSoulNetTranslating, setIsSoulNetTranslatingInternal] = React.useState<boolean>(false);

  console.log('[TranslationContext] MINIMAL TranslationProvider rendered. Current language:', currentLanguage);

  const handleSetLanguage = (language: string) => {
    console.log('[TranslationContext] MINIMAL setLanguage called with:', language);
    setCurrentLanguageInternal(language);
    // In a real scenario, you'd also save to localStorage and potentially clear caches here.
  };

  // Provide a minimal, yet structurally similar, context value
  const value: TranslationContextType = {
    currentLanguage,
    setCurrentLanguage: handleSetLanguage,
    setLanguage: handleSetLanguage, // Alias
    translate: async (text: string) => {
      console.log('[TranslationContext] MINIMAL translate called for:', text.substring(0,30));
      // Simulate translation if not English
      if (currentLanguage !== 'en' && text) {
        return `[${currentLanguage}] ${text}`;
      }
      return text;
    },
    isTranslating,
    clearCache: () => console.log('[TranslationContext] MINIMAL clearCache called'),
    getCachedTranslation: (text: string) => {
      console.log('[TranslationContext] MINIMAL getCachedTranslation called for:', text.substring(0,30));
      return null; // No caching in minimal version
    },
    prefetchTranslationsForRoute: async (route: string) => {
      console.log('[TranslationContext] MINIMAL prefetchTranslationsForRoute called for route:', route);
    },
    prefetchSoulNetTranslations: async (userId: string, timeRange: string) => {
      console.log('[TranslationContext] MINIMAL prefetchSoulNetTranslations called for user:', userId, 'timeRange:', timeRange);
      // Simulate some async work and state change
      setIsSoulNetTranslatingInternal(true);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      setIsSoulNetTranslatingInternal(false);
    },
    isSoulNetTranslating,
    // translationProgress can be omitted if truly minimal, or set to a static value
    translationProgress: isTranslating ? 50 : (isSoulNetTranslating ? 25 : 100),
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
    console.error('useTranslation must be used within a TranslationProvider - context is undefined. This might indicate an issue with the provider or its value.');
    // Returning a default/mock object to prevent app crash during debugging
    // This helps isolate the problem to the Provider itself
    return {
      currentLanguage: 'en-fallback',
      setCurrentLanguage: () => console.warn("Fallback setCurrentLanguage called"),
      setLanguage: () => console.warn("Fallback setLanguage called"),
      translate: async (text: string) => text,
      isTranslating: false,
      clearCache: () => console.warn("Fallback clearCache called"),
      getCachedTranslation: () => null,
      prefetchTranslationsForRoute: async () => console.warn("Fallback prefetchTranslationsForRoute called"),
      prefetchSoulNetTranslations: async () => console.warn("Fallback prefetchSoulNetTranslations called"),
      isSoulNetTranslating: false,
      translationProgress: 100,
    };
  }
  return context;
};
