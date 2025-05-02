
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string; // This must remain a string type
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  sourceLanguage?: string;
  entryId?: number;
  forceTranslate?: boolean; // Prop to force translation regardless of route
  onTranslationStart?: () => void; // Added callback for translation start
  onTranslationEnd?: () => void; // Added callback for translation end
  style?: React.CSSProperties; // Add style prop to the interface
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage,
  entryId,
  forceTranslate = false,
  onTranslationStart,
  onTranslationEnd,
  style // Add style to the destructuring
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>(text); // Initialize with source text
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage, getCachedTranslation } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const textRef = useRef<string>(text); // Track text changes
  const mountedRef = useRef<boolean>(true);
  
  // Check if on website route - but allow forced translation
  const pathname = location.pathname;
  const isOnWebsite = isWebsiteRoute(pathname);
  
  // Helper function to clean translation results
  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    
    // Remove language code suffix like "(hi)" or "[hi]" that might be appended
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };
  
  // Function to translate text with better error handling
  const translateText = async () => {
    // Skip translation if text is empty
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // IMPORTANT CHANGE: Don't skip translation on website routes if forceTranslate is true
    if (isOnWebsite && !forceTranslate) {
      console.log(`TranslatableText: Skipping translation for "${text}" because on website route without force translate`);
      setTranslatedText(text);
      return;
    }

    // Skip translation if already in English and not forcing
    if (currentLanguage === 'en') {
      setTranslatedText(text);
      return;
    }
    
    // Check for cached translation first to prevent flicker
    const cachedResult = getCachedTranslation(text, currentLanguage);
    if (cachedResult) {
      setTranslatedText(cachedResult);
      return;
    }
    
    // Only initiate translation if not in English or if language has changed
    if (!isLoading) {
      setIsLoading(true);
      if (onTranslationStart) {
        onTranslationStart();
      }
    }
      
    try {
      console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage}`);
      // Use "en" as default source language when none is provided
      const result = await translate(text, sourceLanguage || "en", entryId);
      
      // Only update if the component is still mounted, the language hasn't changed during translation
      // and the input text is still the same as when we started
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result) {
          // Clean the translation result before setting it
          const cleanedResult = cleanTranslationResult(result);
          console.log(`TranslatableText: Translation result for "${text.substring(0, 30)}...": "${cleanedResult.substring(0, 30)}..."`);
          setTranslatedText(cleanedResult || text); // Fallback to original if cleaning removes everything
        } else {
          console.log(`TranslatableText: Empty translation result for "${text.substring(0, 30)}..."`);
          setTranslatedText(text); // Fallback to original if result is empty
        }
      }
    } catch (error) {
      console.error(`TranslatableText: Translation error for "${text.substring(0, 30)}..."`, error);
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        setTranslatedText(text); // Fallback to original
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

  // Effect to handle translation when text or language changes
  useEffect(() => {
    mountedRef.current = true;
    
    // Update the refs with current values
    prevLangRef.current = currentLanguage;
    textRef.current = text;

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
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate]);
  
  // Listen to language change events to force re-translate
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log(`TranslatableText: Language change event for "${text.substring(0, 30)}..."`);
      // Update the refs
      prevLangRef.current = currentLanguage;
      textRef.current = text;
      
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
      'data-lang': currentLanguage,
      'data-force-translate': forceTranslate ? 'true' : 'false',
      style // Pass style prop to the element
    }, 
    translatedText || text  // Ensure we always show something, even if translation fails
  );
}

export default TranslatableText;
