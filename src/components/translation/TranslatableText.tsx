
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  sourceLanguage?: string; // Add optional source language prop
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage  // New prop for source language
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
      // Always start with the original text first
      if (isMounted) setTranslatedText(text);
      
      if (!text?.trim()) {
        if (isMounted) setTranslatedText('');
        return;
      }

      // Skip translations for the marketing website pages
      if (isOnWebsite) {
        if (isMounted) setTranslatedText(text);
        return;
      }

      // Only initiate translation if not in English
      if (currentLanguage !== 'en') {
        setIsLoading(true);
        console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage}`);

        try {
          const result = await translate(text, sourceLanguage);
          if (isMounted) {
            setTranslatedText(result || text); // Fallback to original text if result is empty
            console.log(`TranslatableText: Successfully translated to "${result?.substring(0, 30) || 'empty'}..."`);
          }
        } catch (error) {
          console.error('Translation error:', error);
          if (isMounted) {
            setTranslatedText(text); // Fallback to original
            console.warn(`TranslatableText: Failed to translate "${text.substring(0, 30)}..." to ${currentLanguage}`);
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }
    };

    translateText();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate, isOnWebsite, sourceLanguage]);
  
  // Listen to the language change event to force re-render
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      console.log(`TranslatableText: Language change event detected: ${event.detail.language}`);
      // Always set the original text first to ensure content is always visible
      setTranslatedText(text);
      
      // This will re-trigger the translation effect
      if (currentLanguage !== 'en') {
        setIsLoading(true);
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, currentLanguage]);

  // Using React.createElement to avoid type confusion with Three.js components
  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim()
    }, 
    translatedText || text  // Ensure we always show something, even if translation fails
  );
}

export default TranslatableText;
