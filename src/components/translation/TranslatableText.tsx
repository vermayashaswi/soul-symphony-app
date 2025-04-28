import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span' 
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const location = useLocation();
  
  // Determine if we're on a website route (marketing site)
  const isOnWebsite = isWebsiteRoute(location.pathname);

  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (!text?.trim()) {
        if (isMounted) setTranslatedText('');
        return;
      }

      // Skip translations for the marketing website pages
      if (isOnWebsite) {
        if (isMounted) setTranslatedText(text);
        return;
      }

      // Don't translate if we're in English
      if (currentLanguage === 'en') {
        if (isMounted) setTranslatedText(text);
        return;
      }
      
      // CRITICAL: Always keep the current text while translating
      // Never set to empty string during translation process
      setIsLoading(true);
      console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage}`);

      try {
        const result = await translate(text);
        if (isMounted && result && result.trim() !== '') {
          setTranslatedText(result);
          console.log(`TranslatableText: Successfully translated to "${result.substring(0, 30)}..."`);
        }
      } catch (error) {
        console.error('Translation error:', error);
        // Don't reset the text on error
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // Keep the current text if it exists, otherwise translate
    if (text !== translatedText) {
      translateText();
    }

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate, isOnWebsite]);
  
  // Listen to the language change event to force re-render
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      console.log(`TranslatableText: Language change event detected: ${event.detail.language}`);
      
      // Only trigger retranslation if not in English and there's actual text
      if (currentLanguage !== 'en' && text && text.trim() !== '') {
        setIsLoading(true);
        // CRITICAL: Don't clear the text while loading
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [currentLanguage, text]);

  // Using React.createElement to avoid type confusion with Three.js components
  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim()
    }, 
    // Always show some content - never empty string during translation
    translatedText || text
  );
}

export default TranslatableText;
