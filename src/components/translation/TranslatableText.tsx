import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useNoTranslation } from '@/contexts/NoTranslationContext';
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
  const { translationsDisabled } = useNoTranslation();
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
  
  const translateText = async () => {
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // Skip translation if translations are disabled
    if (translationsDisabled) {
      setTranslatedText(text);
      setIsLoading(false);
      return;
    }

    // Log detailed state for debugging
    console.log('🔤 TranslatableText: TRANSLATION ATTEMPT:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      currentLanguage,
      sourceLanguage,
      forceTranslate,
      isOnWebsite,
      pathname,
      attemptNumber: translationAttemptRef.current + 1
    });

    // Skip translation only if languages match AND forceTranslate is false
    if (currentLanguage === sourceLanguage && !forceTranslate) {
      console.log(`🔤 TranslatableText: ⏭️ SKIPPING - Same language (${currentLanguage}), forceTranslate: ${forceTranslate}`);
      setTranslatedText(text);
      return;
    }

    // Development mode override for testing
    if (forceTranslate && currentLanguage === sourceLanguage) {
      console.log(`🔤 TranslatableText: 🧪 FORCE TRANSLATE enabled for "${text.substring(0, 30)}"`);
    }

    // Check cache first
    const cachedResult = getCachedTranslation(text);
    if (cachedResult) {
      console.log(`🔤 TranslatableText: 💾 Using cached translation for "${text.substring(0, 30)}": "${cachedResult.substring(0, 30)}"`);
      setTranslatedText(cachedResult);
      return;
    }
    
    // Increment attempt counter for debugging
    translationAttemptRef.current += 1;
    const attemptNumber = translationAttemptRef.current;
    
    console.log(`🔤 TranslatableText: 🚀 Starting translation attempt #${attemptNumber} for "${text.substring(0, 30)}" to ${currentLanguage}`);
    
    if (!isLoading) {
      setIsLoading(true);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    try {
      console.log(`🔤 TranslatableText: 📤 CALLING TRANSLATE SERVICE:`, {
        text: text.substring(0, 50),
        sourceLanguage,
        targetLanguage: currentLanguage,
        forceTranslate,
        attemptNumber
      });
      
      const result = await translate(text, sourceLanguage, entryId, forceTranslate);
      
      console.log(`🔤 TranslatableText: 📥 TRANSLATE SERVICE RESPONSE:`, {
        originalText: text.substring(0, 30),
        translatedText: result?.substring(0, 30) || 'null',
        isChanged: result !== text,
        attemptNumber
      });
      
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result) {
          const cleanedResult = cleanTranslationResult(result);
          console.log(`🔤 TranslatableText: ✅ SETTING TRANSLATED TEXT:`, {
            original: text.substring(0, 30),
            cleaned: cleanedResult.substring(0, 30),
            attemptNumber
          });
          setTranslatedText(cleanedResult || text);
        } else {
          console.log(`🔤 TranslatableText: ⚠️ EMPTY RESULT, using original:`, {
            text: text.substring(0, 30),
            attemptNumber
          });
          setTranslatedText(text);
        }
      } else {
        console.log(`🔤 TranslatableText: 🚫 COMPONENT STATE CHANGED, ignoring result:`, {
          mounted: mountedRef.current,
          langMatch: prevLangRef.current === currentLanguage,
          textMatch: textRef.current === text,
          attemptNumber
        });
      }
    } catch (error) {
      console.error(`🔤 TranslatableText: ❌ TRANSLATION ERROR:`, {
        text: text.substring(0, 30),
        error,
        attemptNumber
      });
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
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate, translationsDisabled]);
  
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      const { language: newLanguage, timestamp } = event.detail || {};
      console.log(`🔤 TranslatableText: 📢 LANGUAGE CHANGE EVENT:`, {
        text: text.substring(0, 30),
        oldLang: currentLanguage,
        newLang: newLanguage,
        eventTimestamp: timestamp,
        currentTimestamp: Date.now()
      });
      
      // Update refs immediately
      prevLangRef.current = newLanguage || currentLanguage;
      textRef.current = text;
      translationAttemptRef.current = 0; // Reset attempt counter
      
      // Trigger translation with small delay to ensure state propagation
      setTimeout(() => {
        console.log(`🔤 TranslatableText: 🔄 RETRANSLATING after language change:`, {
          text: text.substring(0, 30),
          newLang: newLanguage || currentLanguage
        });
        translateText();
      }, 10);
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage, forceTranslate, translationsDisabled]);

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