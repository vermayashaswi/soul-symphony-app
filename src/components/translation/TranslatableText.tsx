
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
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage,
  entryId
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  
  // Determine if we're on a website route (marketing site)
  const isOnWebsite = isWebsiteRoute(location.pathname);

  // Function to translate text
  const translateText = async () => {
    // Skip translation if text is empty
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // Skip translations for the marketing website pages
    if (isOnWebsite) {
      setTranslatedText(text);
      return;
    }

    // Only initiate translation if not in English or if language has changed
    if (currentLanguage !== 'en') {
      if (!isLoading) {
        setIsLoading(true);
      }
      
      console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage} from ${sourceLanguage || 'en'}${entryId ? ` for entry: ${entryId}` : ''}`);

      try {
        // Use "en" as default source language when none is provided
        const result = await translate(text, sourceLanguage || "en", entryId);
        
        // Only update if the language hasn't changed during translation
        if (prevLangRef.current === currentLanguage) {
          setTranslatedText(result || text); // Fallback to original text if result is empty
          console.log(`TranslatableText: Successfully translated to "${result?.substring(0, 30) || 'empty'}..."`);
        } else {
          console.log('Language changed during translation, discarding result');
        }
      } catch (error) {
        console.error('Translation error:', error);
        if (prevLangRef.current === currentLanguage) {
          setTranslatedText(text); // Fallback to original
        }
        console.warn(`TranslatableText: Failed to translate "${text.substring(0, 30)}..." to ${currentLanguage}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // For English, just use the original text
      setTranslatedText(text);
    }
  };

  // Effect to handle translation when text or language changes
  useEffect(() => {
    let isMounted = true;

    // Update the ref with current language
    prevLangRef.current = currentLanguage;

    // Set to text immediately for better UX while translating
    if (!initialLoadDoneRef.current || !translatedText) {
      setTranslatedText(text);
    }

    const handleTranslation = async () => {
      if (isMounted) {
        await translateText();
        if (isMounted) {
          initialLoadDoneRef.current = true;
        }
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
      // Update the ref
      prevLangRef.current = currentLanguage;
      
      // If we don't have a translation yet, set to original text during translation
      if (!translatedText) {
        setTranslatedText(text);
      }
      
      // Then retranslate
      translateText();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage]);

  // Using React.createElement to avoid type confusion with Three.js components
  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim(),
      'data-translating': isLoading ? 'true' : 'false'
    }, 
    translatedText || text  // Ensure we always show something, even if translation fails
  );
}

export default TranslatableText;
