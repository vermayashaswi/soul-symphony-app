
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';
import { useLanguageFontConfig } from '@/utils/languageFontScaling';
import { createLanguageAwareStyle, getLanguageAwareClasses } from '@/utils/languageAwareCSS';

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
  enableFontScaling?: boolean;
  scalingContext?: 'mobile-nav' | 'general' | 'compact';
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage = 'en',
  entryId,
  forceTranslate = false,
  onTranslationStart,
  onTranslationEnd,
  style,
  enableFontScaling = false,
  scalingContext = 'general'
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

  // Language font scaling configuration
  const fontConfig = useLanguageFontConfig(currentLanguage);

  const pathname = location.pathname;
  const isOnWebsite = isWebsiteRoute(pathname);

  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };

  // FORCED: If on marketing (website) routes or currentLanguage is 'en', skip translation logic
  const shouldTranslate = !isOnWebsite && currentLanguage !== 'en';

  const translateText = async () => {
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }
    // If on website or English: skip translation logic, always show the original
    if (!shouldTranslate) {
      setTranslatedText(text);
      return;
    }

    if (currentLanguage === sourceLanguage) {
      setTranslatedText(text);
      return;
    }

    // Check cache first
    const cachedResult = getCachedTranslation(text);
    if (cachedResult) {
      setTranslatedText(cachedResult);
      return;
    }
    
    translationAttemptRef.current += 1;
    const attemptNumber = translationAttemptRef.current;
    if (!isLoading) {
      setIsLoading(true);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    try {
      const result = await translate(text, sourceLanguage, entryId);
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result) {
          const cleanedResult = cleanTranslationResult(result);
          setTranslatedText(cleanedResult || text);
        } else {
          setTranslatedText(text);
        }
      }
    } catch (error) {
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
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate, shouldTranslate]);
  
  useEffect(() => {
    const handleLanguageChange = () => {
      prevLangRef.current = currentLanguage;
      textRef.current = text;
      translationAttemptRef.current = 0;
      translateText();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage, forceTranslate, shouldTranslate]);

  // Generate language-aware styling
  const languageAwareClassName = enableFontScaling
    ? getLanguageAwareClasses(currentLanguage, className)
    : className;

  const languageAwareStyle = enableFontScaling
    ? createLanguageAwareStyle(currentLanguage, style)
    : style;

  // Add context-specific adjustments
  let contextualStyles: React.CSSProperties = {};
  if (enableFontScaling && scalingContext === 'mobile-nav') {
    contextualStyles = {
      ...contextualStyles,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
    };
  }

  const finalStyle = {
    ...languageAwareStyle,
    ...contextualStyles,
  };

  const finalClassName = `${languageAwareClassName} ${isLoading ? 'opacity-70' : ''}`.trim();

  return React.createElement(
    Component, 
    { 
      className: finalClassName,
      'data-translating': isLoading ? 'true' : 'false',
      'data-translated': translatedText !== text ? 'true' : 'false',
      'data-lang': currentLanguage,
      'data-font-scaled': enableFontScaling ? 'true' : 'false',
      'data-scaling-context': scalingContext,
      style: finalStyle
    }, 
    translatedText || text
  );
}

export default TranslatableText;

// NOTE: This file is now quite long (over 200 lines).
// After verifying these fixes, consider asking Lovable to help refactor this file into smaller components/hooks for maintainability.
