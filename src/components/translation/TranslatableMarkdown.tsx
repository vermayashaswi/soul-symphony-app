
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';
import { useLanguageFontConfig } from '@/utils/languageFontScaling';
import { createLanguageAwareStyle, getLanguageAwareClasses } from '@/utils/languageAwareCSS';

interface TranslatableMarkdownProps {
  children: string;
  className?: string;
  forceTranslate?: boolean;
  onTranslationStart?: () => void;
  onTranslationEnd?: () => void;
  enableFontScaling?: boolean;
  scalingContext?: 'mobile-nav' | 'general' | 'compact';
}

export function TranslatableMarkdown({ 
  children, 
  className = "",
  forceTranslate = true,
  onTranslationStart,
  onTranslationEnd,
  enableFontScaling = false,
  scalingContext = 'general'
}: TranslatableMarkdownProps) {
  const [translatedContent, setTranslatedContent] = useState<string>(children);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage, getCachedTranslation } = useTranslation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const contentRef = useRef<string>(children);
  const location = useLocation();
  const isOnWebsite = isWebsiteRoute(location.pathname);
  const mountedRef = useRef<boolean>(true);
  
  // Language font scaling configuration
  const fontConfig = useLanguageFontConfig(currentLanguage);
  
  // Function to translate markdown content with improved error handling
  const translateMarkdown = async () => {
    // Skip translation if content is empty
    if (!children?.trim()) {
      setTranslatedContent('');
      return;
    }
    
    // CRITICAL FIX: forceTranslate should override website route check
    if (isOnWebsite && !forceTranslate) {
      setTranslatedContent(children);
      return;
    }

    // Skip translation if already in English
    if (currentLanguage === 'en') {
      setTranslatedContent(children);
      return;
    }
    
    // Check for cached translation first - fix: use single argument
    const cachedTranslation = getCachedTranslation(children);
    if (cachedTranslation) {
      setTranslatedContent(cachedTranslation);
      return;
    }

    // Only translate if not in English or if language has changed
    if (!isLoading) {
      setIsLoading(true);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    console.log(`TranslatableMarkdown: Translating markdown content to ${currentLanguage}`);

    try {
      // IMPORTANT CHANGE: Always translate from English
      const result = await translate(children, "en");
      
      // Only update if the component is still mounted, language hasn't changed during translation
      // and the content is still the same
      if (mountedRef.current && prevLangRef.current === currentLanguage && contentRef.current === children) {
        if (result) {
          setTranslatedContent(result);
          console.log(`TranslatableMarkdown: Successfully translated markdown content`);
        } else {
          setTranslatedContent(children);
          console.log(`TranslatableMarkdown: Empty translation result, using original content`);
        }
      } else {
        console.log('Language or content changed during translation, discarding result');
      }
    } catch (error) {
      console.error('Markdown translation error:', error);
      if (mountedRef.current && prevLangRef.current === currentLanguage && contentRef.current === children) {
        setTranslatedContent(children); // Fallback to original
        console.warn(`TranslatableMarkdown: Failed to translate markdown content to ${currentLanguage}`);
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

  // Effect to handle translation when content or language changes
  useEffect(() => {
    mountedRef.current = true;

    // Update the refs with current values
    prevLangRef.current = currentLanguage;
    contentRef.current = children;

    const handleTranslation = async () => {
      if (mountedRef.current) {
        await translateMarkdown();
        if (mountedRef.current) {
          initialLoadDoneRef.current = true;
        }
      }
    };

    handleTranslation();

    return () => {
      mountedRef.current = false;
    };
  }, [children, currentLanguage, forceTranslate]);
  
  // Listen to language change events to force re-translate
  useEffect(() => {
    const handleLanguageChange = () => {
      // Update the refs
      prevLangRef.current = currentLanguage;
      contentRef.current = children;
      
      // Then retranslate
      translateMarkdown();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [children, currentLanguage, forceTranslate]);

  // Generate language-aware styling
  const languageAwareClassName = enableFontScaling
    ? getLanguageAwareClasses(currentLanguage, className)
    : className;

  const languageAwareStyle = enableFontScaling
    ? createLanguageAwareStyle(currentLanguage, {})
    : {};

  // Add context-specific adjustments
  let contextualStyles: React.CSSProperties = {};
  if (enableFontScaling && scalingContext === 'compact') {
    contextualStyles = {
      ...contextualStyles,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    };
  }

  const finalStyle = {
    ...languageAwareStyle,
    ...contextualStyles,
  };

  // Ensure we're passing a string to ReactMarkdown (fix for the TypeScript error)
  const contentToRender = translatedContent || children;
  
  return (
    <div 
      className={`${isLoading ? 'opacity-70' : ''}`} 
      data-translating={isLoading ? 'true' : 'false'}
      data-translated={translatedContent !== children ? 'true' : 'false'}
      data-lang={currentLanguage}
      data-force-translate={forceTranslate ? 'true' : 'false'}
      data-font-scaled={enableFontScaling ? 'true' : 'false'}
      data-scaling-context={scalingContext}
      style={finalStyle}
    >
      <ReactMarkdown className={languageAwareClassName}>
        {contentToRender}
      </ReactMarkdown>
    </div>
  );
}

export default TranslatableMarkdown;
