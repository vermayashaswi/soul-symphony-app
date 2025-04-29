
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  sourceLanguage?: string;  // The detected language of the content
  entryId?: number;  // Added entryId parameter
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage,
  entryId
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const location = useLocation();
  
  // Determine if we're on a website route (marketing site)
  const isOnWebsite = isWebsiteRoute(location.pathname);

  // Function to translate text
  const translateText = async () => {
    // Always start with the original text first
    setTranslatedText(text);
    
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // Skip translations for the marketing website pages
    if (isOnWebsite) {
      setTranslatedText(text);
      return;
    }

    // Only initiate translation if not in English
    if (currentLanguage !== 'en') {
      setIsLoading(true);
      console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage} from ${sourceLanguage || 'en'} for entry: ${entryId || 'unknown'}`);

      try {
        // Use "en" as default source language when none is provided
        const result = await translate(text, sourceLanguage || "en", entryId);
        setTranslatedText(result || text); // Fallback to original text if result is empty
        console.log(`TranslatableText: Successfully translated to "${result?.substring(0, 30) || 'empty'}..."`);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedText(text); // Fallback to original
        console.warn(`TranslatableText: Failed to translate "${text.substring(0, 30)}..." to ${currentLanguage}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Effect to handle translation when text or language changes
  useEffect(() => {
    let isMounted = true;

    const handleTranslation = async () => {
      if (isMounted) {
        await translateText();
      }
    };

    handleTranslation();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, sourceLanguage, entryId]);
  
  // Listen to language change events to force re-translate
  useEffect(() => {
    const handleLanguageChange = () => {
      // First set to original text to ensure visibility during translation
      setTranslatedText(text);
      
      // Then retranslate
      translateText();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, sourceLanguage, entryId]);

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
