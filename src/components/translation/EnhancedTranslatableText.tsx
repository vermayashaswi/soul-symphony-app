import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useInsightsTranslation } from '@/components/insights/InsightsTranslationProvider';
import { useLocation } from 'react-router-dom';
import { useLanguageFontConfig } from '@/utils/languageFontScaling';
import { createLanguageAwareStyle, getLanguageAwareClasses } from '@/utils/languageAwareCSS';

interface EnhancedTranslatableTextProps {
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
  usePageTranslation?: boolean;
}

// Implement isWebsiteRoute locally for now:
const isWebsiteRoute = (pathname: string) => !pathname.startsWith('/app');

export function EnhancedTranslatableText({ 
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
  scalingContext = 'general',
  usePageTranslation = false
}: EnhancedTranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage, getCachedTranslation } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const textRef = useRef<string>(text);
  const mountedRef = useRef<boolean>(true);
  
  // Try to get page-level translation if on insights page
  const isInsightsPage = location.pathname === '/insights';
  const insightsTranslation = isInsightsPage ? useInsightsTranslation() : null;
  
  // Language font scaling configuration
  const fontConfig = useLanguageFontConfig(currentLanguage);
  
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

    // Don't translate if already in the target language
    if (currentLanguage === sourceLanguage) {
      setTranslatedText(text);
      return;
    }

    // For insights page, try page-level translation first
    if (usePageTranslation && isInsightsPage && insightsTranslation) {
      const pageTranslation = insightsTranslation.getTranslation(text);
      if (pageTranslation) {
        console.log(`[EnhancedTranslatableText] Using page-level translation for: "${text.substring(0, 30)}"`);
        setTranslatedText(pageTranslation);
        return;
      }
    }

    // Check individual cache
    const cachedResult = getCachedTranslation(text);
    if (cachedResult) {
      setTranslatedText(cachedResult);
      return;
    }
    
    console.log(`[EnhancedTranslatableText] Starting individual translation for: "${text.substring(0, 30)}"`);
    
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
      console.error(`[EnhancedTranslatableText] Translation error for "${text.substring(0, 30)}"`, error);
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

    const handleTranslation = async () => {
      if (mountedRef.current) {
        await translateText();
      }
    };

    handleTranslation();

    return () => {
      mountedRef.current = false;
    };
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate]);
  
  useEffect(() => {
    const handleLanguageChange = () => {
      prevLangRef.current = currentLanguage;
      textRef.current = text;
      translateText();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage, forceTranslate]);

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

export default EnhancedTranslatableText;
