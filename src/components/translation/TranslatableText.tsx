
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
  forceTranslate?: boolean; // Prop to force translation regardless of route
  onTranslationStart?: () => void; // Added callback for translation start
  onTranslationEnd?: () => void; // Added callback for translation end
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage,
  entryId,
  forceTranslate = false,
  onTranslationStart,
  onTranslationEnd
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const textRef = useRef<string>(text); // Track text changes
  
  // Always treat / route as an app route for translation purposes
  const pathname = location.pathname;
  const isOnWebsite = isWebsiteRoute(pathname);
  
  // Function to translate text with better error handling
  const translateText = async () => {
    // Skip translation if text is empty
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // For diagnostic purposes
    console.log(`TranslatableText: Route ${pathname} is ${isOnWebsite ? 'website' : 'app'} route, forceTranslate: ${forceTranslate}`);

    // Skip translations for the marketing website pages, unless forceTranslate is true
    if (isOnWebsite && !forceTranslate) {
      console.log(`TranslatableText: Skipping translation for website route: "${text.substring(0, 30)}..."`);
      setTranslatedText(text);
      return;
    }

    // Skip translation if already in English and not forcing
    if (currentLanguage === 'en') {
      setTranslatedText(text);
      return;
    }
    
    // Only initiate translation if not in English or if language has changed
    if (!isLoading) {
      setIsLoading(true);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage} from ${sourceLanguage || 'en'}${entryId ? ` for entry: ${entryId}` : ''}`);

    try {
      // Use "en" as default source language when none is provided
      const result = await translate(text, sourceLanguage || "en", entryId);
      
      // Only update if the language hasn't changed during translation and
      // the input text is still the same as when we started
      if (prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result) {
          setTranslatedText(result);
          console.log(`TranslatableText: Successfully translated to "${result.substring(0, 30)}..."`);
        } else {
          setTranslatedText(text); // Fallback to original if result is empty
          console.log(`TranslatableText: Empty translation result, using original text`);
        }
      } else {
        console.log('Language or text changed during translation, discarding result');
      }
    } catch (error) {
      console.error('Translation error:', error);
      if (prevLangRef.current === currentLanguage && textRef.current === text) {
        setTranslatedText(text); // Fallback to original
        console.warn(`TranslatableText: Failed to translate "${text.substring(0, 30)}..." to ${currentLanguage}`);
      }
    } finally {
      setIsLoading(false);
      if (onTranslationEnd) {
        onTranslationEnd();
      }
    }
  };

  // Effect to handle translation when text or language changes
  useEffect(() => {
    let isMounted = true;
    
    // Update the refs with current values
    prevLangRef.current = currentLanguage;
    textRef.current = text;

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
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate]);
  
  // Listen to language change events to force re-translate
  useEffect(() => {
    const handleLanguageChange = () => {
      // Update the refs
      prevLangRef.current = currentLanguage;
      textRef.current = text;
      
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
      'data-translating': isLoading ? 'true' : 'false',
      'data-translated': translatedText !== text ? 'true' : 'false',
      'data-lang': currentLanguage
    }, 
    translatedText || text  // Ensure we always show something, even if translation fails
  );
}

export default TranslatableText;
