
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
  
  const translateText = async () => {
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // Enhanced debug logging for force translate
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
    
    // Check cache first - fix: use single argument
    const cachedResult = getCachedTranslation(text);
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
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    try {
      // Force translation by using staticTranslationService directly
      console.log(`TranslatableText: Calling translate service for "${text.substring(0, 30)}..." to ${currentLanguage}`);
      const result = await translate(text, "en", entryId);
      
      console.log(`TranslatableText: Translation service returned for "${text.substring(0, 30)}...": "${result?.substring(0, 30) || 'null'}..."`);
      
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result) {
          const cleanedResult = cleanTranslationResult(result);
          console.log(`TranslatableText: Setting translated text for "${text.substring(0, 30)}...": "${cleanedResult.substring(0, 30)}..."`);
          setTranslatedText(cleanedResult || text);
        } else {
          console.log(`TranslatableText: Empty translation result for "${text.substring(0, 30)}...", using original`);
          setTranslatedText(text);
        }
      }
    } catch (error) {
      console.error(`TranslatableText: Translation error for "${text.substring(0, 30)}..."`, error);
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        setTranslatedText(text);
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
    translationAttemptRef.current = 0; // Reset attempt counter

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
      translationAttemptRef.current = 0; // Reset attempt counter
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
      style
    }, 
    translatedText || text
  );
}

export default TranslatableText;
