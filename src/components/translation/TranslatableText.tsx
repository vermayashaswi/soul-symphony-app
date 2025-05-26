
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  sourceLanguage?: string;
  entryId?: number;
  forceTranslate?: boolean;
  onTranslationStart?: () => void;
  onTranslationEnd?: () => void;
  style?: React.CSSProperties;
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage,
  entryId,
  forceTranslate = false,
  onTranslationStart,
  onTranslationEnd,
  style
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { translate, currentLanguage, getCachedTranslation } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const textRef = useRef<string>(text);
  const mountedRef = useRef<boolean>(true);
  const translationAttemptRef = useRef<number>(0);
  
  const pathname = location.pathname;
  const isOnWebsite = isWebsiteRoute(pathname);
  
  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };
  
  // Fallback translation using static mapping for common navigation items
  const getStaticTranslation = (text: string, language: string): string | null => {
    const staticTranslations: Record<string, Record<string, string>> = {
      'hi': {
        'Home': 'होम',
        'Journal': 'डायरी',
        'Chat': 'चैट',
        'Insights': 'अंतर्दृष्टि',
        'Settings': 'सेटिंग्स'
      },
      'es': {
        'Home': 'Inicio',
        'Journal': 'Diario',
        'Chat': 'Chat',
        'Insights': 'Perspectivas',
        'Settings': 'Configuración'
      },
      'fr': {
        'Home': 'Accueil',
        'Journal': 'Journal',
        'Chat': 'Chat',
        'Insights': 'Aperçus',
        'Settings': 'Paramètres'
      }
    };
    
    const langTranslations = staticTranslations[language];
    if (langTranslations && langTranslations[text]) {
      console.log(`TranslatableText: Using static fallback translation for "${text}": "${langTranslations[text]}"`);
      return langTranslations[text];
    }
    
    return null;
  };
  
  const translateText = async () => {
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    console.log(`TranslatableText: Translation check for "${text}" - forceTranslate: ${forceTranslate}, isOnWebsite: ${isOnWebsite}, currentLanguage: ${currentLanguage}`);

    if (isOnWebsite && !forceTranslate) {
      console.log(`TranslatableText: Skipping translation for "${text}" - on website without force translate`);
      setTranslatedText(text);
      return;
    }

    if (currentLanguage === 'en') {
      console.log(`TranslatableText: Skipping translation for "${text}" - already in English`);
      setTranslatedText(text);
      return;
    }
    
    // Try static fallback first for common navigation items
    const staticTranslation = getStaticTranslation(text, currentLanguage);
    if (staticTranslation) {
      setTranslatedText(staticTranslation);
      return;
    }
    
    // Check cache first
    const cachedResult = getCachedTranslation(text, currentLanguage);
    if (cachedResult) {
      console.log(`TranslatableText: Using cached translation for "${text}": "${cachedResult}"`);
      setTranslatedText(cachedResult);
      return;
    }
    
    // Increment attempt counter for debugging
    translationAttemptRef.current += 1;
    const attemptNumber = translationAttemptRef.current;
    
    console.log(`TranslatableText: Starting translation attempt #${attemptNumber} for "${text}" to ${currentLanguage}`);
    
    if (!isLoading) {
      setIsLoading(true);
      setError(null);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    try {
      console.log(`TranslatableText: Calling translate service for "${text.substring(0, 30)}..." to ${currentLanguage}`);
      const result = await translate(text, "en", entryId);
      
      console.log(`TranslatableText: Translation service returned for "${text.substring(0, 30)}...": "${result?.substring(0, 30) || 'null'}..."`);
      
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result && result !== text) {
          const cleanedResult = cleanTranslationResult(result);
          console.log(`TranslatableText: Setting translated text for "${text.substring(0, 30)}...": "${cleanedResult.substring(0, 30)}..."`);
          setTranslatedText(cleanedResult || text);
          setError(null);
        } else {
          console.log(`TranslatableText: Translation service returned original text, checking for fallback`);
          // If translation service failed, try static fallback again
          const fallbackTranslation = getStaticTranslation(text, currentLanguage);
          if (fallbackTranslation) {
            setTranslatedText(fallbackTranslation);
          } else {
            console.log(`TranslatableText: No fallback available, using original text`);
            setTranslatedText(text);
          }
        }
      }
    } catch (error) {
      console.error(`TranslatableText: Translation error for "${text.substring(0, 30)}..."`, error);
      setError(error instanceof Error ? error.message : 'Translation failed');
      
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        // Try static fallback on error
        const fallbackTranslation = getStaticTranslation(text, currentLanguage);
        if (fallbackTranslation) {
          console.log(`TranslatableText: Using static fallback after error for "${text}": "${fallbackTranslation}"`);
          setTranslatedText(fallbackTranslation);
        } else {
          setTranslatedText(text);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        if (onTranslationEnd) {
          onTranslationEnd();
        }
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    prevLangRef.current = currentLanguage;
    textRef.current = text;
    translationAttemptRef.current = 0;

    const handleTranslation = async () => {
      if (mountedRef.current) {
        await translateText();
        if (mountedRef.current) {
          initialLoadDoneRef.current = true;
        }
      }
    };

    handleTranslation();

    return () => {
      mountedRef.current = false;
    };
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate]);
  
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log(`TranslatableText: Language change event detected for "${text.substring(0, 30)}..." - new language: ${currentLanguage}`);
      prevLangRef.current = currentLanguage;
      textRef.current = text;
      translationAttemptRef.current = 0;
      translateText();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage, forceTranslate]);

  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim(),
      'data-translating': isLoading ? 'true' : 'false',
      'data-translated': translatedText !== text ? 'true' : 'false',
      'data-lang': currentLanguage,
      'data-force-translate': forceTranslate ? 'true' : 'false',
      'data-original-text': text,
      'data-translation-attempts': translationAttemptRef.current,
      'data-error': error || undefined,
      style
    }, 
    translatedText || text
  );
}

export default TranslatableText;
