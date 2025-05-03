
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
  onTranslationStart?: () => void;
  onTranslationEnd?: () => void;
  style?: React.CSSProperties;
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
  style
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>(text); // Initialize with source text
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage, getCachedTranslation } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const textRef = useRef<string>(text);
  const mountedRef = useRef<boolean>(true);
  
  // Check if on website route - but allow forced translation
  const pathname = location.pathname;
  const isOnWebsite = isWebsiteRoute(pathname);
  
  // Enhanced logging to help debug translation issues
  useEffect(() => {
    console.log(`TranslatableText (${text.substring(0, 20)}...): forceTranslate=${forceTranslate}, isOnWebsite=${isOnWebsite}, path=${pathname}`);
  }, [text, forceTranslate, isOnWebsite, pathname]);
  
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

    // CRITICAL FIX: In THREE.JS and Soul-Net context, ALWAYS translate regardless of route
    // 100% Honor forceTranslate flag to override website route check
    // Or if path contains insights or we detect we're in the insights visualization
    const isInsightsRelated = pathname.includes('insights') || 
                             window.location.href.includes('insights') || 
                             document.querySelector('.soul-net-visualization') !== null;
    
    const shouldTranslate = forceTranslate || isInsightsRelated;
    
    if (isOnWebsite && !shouldTranslate) {
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
      console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage}, forceTranslate=${forceTranslate}, path=${pathname}`);
      // Use "en" as default source language when none is provided
      const result = await translate(text, sourceLanguage || "en", entryId);
      
      // Only update if the component is still mounted, the language hasn't changed during translation
      // and the input text is still the same as when we started
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result) {
          // Clean the translation result before setting it
          const cleanedTranslation = cleanTranslationResult(result);
          console.log(`TranslatableText: Translation result for "${text.substring(0, 30)}...": "${cleanedTranslation.substring(0, 30)}..."`);
          setTranslatedText(cleanedTranslation || text); // Fallback to original if cleaning removes everything
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
      'data-path': pathname,
      'data-insights': pathname.includes('insights') ? 'true' : 'false',
      style: {
        ...style,
        // Increase style priority for Three.js contexts
        textShadow: forceTranslate ? '0 0 5px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)' : style?.textShadow,
        zIndex: forceTranslate ? 100000 : style?.zIndex,
      }
    }, 
    translatedText || text
  );
}

export default TranslatableText;
