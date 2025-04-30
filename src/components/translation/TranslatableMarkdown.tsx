
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableMarkdownProps {
  children: string;
  className?: string;
  forceTranslate?: boolean; // Added forceTranslate prop for consistency
  onTranslationStart?: () => void;
  onTranslationEnd?: () => void;
}

export function TranslatableMarkdown({ 
  children, 
  className = "",
  forceTranslate = true, // Default to true to fix chat messages
  onTranslationStart,
  onTranslationEnd
}: TranslatableMarkdownProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const contentRef = useRef<string>(children);
  const location = useLocation();
  const isOnWebsite = isWebsiteRoute(location.pathname);
  
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

    // Only translate if not in English or if language has changed
    if (!isLoading) {
      setIsLoading(true);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    console.log(`TranslatableMarkdown: Translating markdown content to ${currentLanguage}`);

    try {
      const result = await translate(children, "en");
      
      // Only update if the language hasn't changed during translation
      // and the content is still the same
      if (prevLangRef.current === currentLanguage && contentRef.current === children) {
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
      if (prevLangRef.current === currentLanguage && contentRef.current === children) {
        setTranslatedContent(children); // Fallback to original
        console.warn(`TranslatableMarkdown: Failed to translate markdown content to ${currentLanguage}`);
      }
    } finally {
      setIsLoading(false);
      if (onTranslationEnd) {
        onTranslationEnd();
      }
    }
  };

  // Effect to handle translation when content or language changes
  useEffect(() => {
    let isMounted = true;

    // Update the refs with current values
    prevLangRef.current = currentLanguage;
    contentRef.current = children;

    // Set to original content immediately for better UX while translating
    if (!initialLoadDoneRef.current || !translatedContent) {
      setTranslatedContent(children);
    }

    const handleTranslation = async () => {
      if (isMounted) {
        await translateMarkdown();
        if (isMounted) {
          initialLoadDoneRef.current = true;
        }
      }
    };

    handleTranslation();

    return () => {
      isMounted = false;
    };
  }, [children, currentLanguage, forceTranslate]);
  
  // Listen to language change events to force re-translate
  useEffect(() => {
    const handleLanguageChange = () => {
      // Update the refs
      prevLangRef.current = currentLanguage;
      contentRef.current = children;
      
      // If we don't have a translation yet, set to original text during translation
      if (!translatedContent) {
        setTranslatedContent(children);
      }
      
      // Then retranslate
      translateMarkdown();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [children, currentLanguage, forceTranslate]);

  // Ensure we're passing a string to ReactMarkdown (fix for the TypeScript error)
  const contentToRender = translatedContent || children;
  
  return (
    <div 
      className={`${isLoading ? 'opacity-70' : ''}`} 
      data-translating={isLoading ? 'true' : 'false'}
      data-translated={translatedContent !== children ? 'true' : 'false'}
      data-lang={currentLanguage}
      data-force-translate={forceTranslate ? 'true' : 'false'}
    >
      <ReactMarkdown className={className}>
        {contentToRender}
      </ReactMarkdown>
    </div>
  );
}

export default TranslatableMarkdown;
