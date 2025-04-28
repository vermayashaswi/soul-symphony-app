
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

// Regular expressions to detect language markers like [hi], [en], etc.
const LANGUAGE_MARKER_REGEX = /^\[(\w+)\]\s*(.*)$/;

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

  // Function to clean text of language markers
  const cleanTextOfMarkers = (input: string): string => {
    if (!input) return '';
    return input.replace(/\[\w+\]\s*/g, '');
  };

  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (!text?.trim()) {
        if (isMounted) setTranslatedText('');
        return;
      }

      // Clean the text of any language markers before translation
      const cleanedText = cleanTextOfMarkers(text);
      
      // Skip translations for the marketing website pages
      if (isOnWebsite) {
        if (isMounted) setTranslatedText(cleanedText);
        return;
      }

      // Fallback to dynamic translation service if not in English
      if (currentLanguage !== 'en') {
        setIsLoading(true);
        console.log(`TranslatableText: Translating "${cleanedText.substring(0, 30)}..." to ${currentLanguage}`);

        try {
          const result = await translate(cleanedText);
          if (isMounted) {
            setTranslatedText(result);
            console.log(`TranslatableText: Successfully translated to "${result.substring(0, 30)}..."`);
          }
        } catch (error) {
          console.error('Translation error:', error);
          if (isMounted) {
            setTranslatedText(cleanedText); // Fallback to original cleaned text
            console.warn(`TranslatableText: Failed to translate "${cleanedText.substring(0, 30)}..." to ${currentLanguage}`);
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else {
        if (isMounted) setTranslatedText(cleanedText);
      }
    };

    translateText();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate, isOnWebsite]);
  
  // Listen to the language change event to force re-render
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      console.log(`TranslatableText: Language change event detected: ${event.detail.language}`);
      // This will re-trigger the translation effect
      if (currentLanguage !== 'en') {
        setTranslatedText(''); // Clear to show loading state
        setIsLoading(true);
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, []);

  // Using React.createElement to avoid type confusion with Three.js components
  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim()
    }, 
    translatedText
  );
}

export default TranslatableText;
