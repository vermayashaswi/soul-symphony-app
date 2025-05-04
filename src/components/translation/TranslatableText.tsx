
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
  const [translationFailed, setTranslationFailed] = useState(false);
  const { translate, currentLanguage, getCachedTranslation, forceRetranslate } = useTranslation();
  const location = useLocation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  const textRef = useRef<string>(text); // Track text changes
  const mountedRef = useRef<boolean>(true);
  const retryAttemptsRef = useRef<number>(0);
  
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
  const translateText = async (shouldForceTranslate = false) => {
    // Skip translation if text is empty
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // CRITICAL FIX: Don't skip translation on website routes if forceTranslate is true
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
    if (cachedResult && !shouldForceTranslate) {
      setTranslatedText(cachedResult);
      setTranslationFailed(false);
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
      
      let result;
      
      // Use forceRetranslate if requested or if previous attempts failed
      if (shouldForceTranslate) {
        result = await forceRetranslate(text);
      } else {
        // IMPORTANT CHANGE: Always use "en" as the default source language regardless of what was provided
        result = await translate(text, "en", entryId);
      }
      
      // Only update if the component is still mounted, the language hasn't changed during translation
      // and the input text is still the same as when we started
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        if (result && result !== text) { // Ensure we got an actual translation that's different
          // Clean the translation result before setting it
          const cleanedResult = cleanTranslationResult(result);
          console.log(`TranslatableText: Translation result for "${text.substring(0, 30)}...": "${cleanedResult.substring(0, 30)}..."`);
          setTranslatedText(cleanedResult || text); // Fallback to original if cleaning removes everything
          setTranslationFailed(false);
          retryAttemptsRef.current = 0;
        } else {
          console.log(`TranslatableText: Empty or unchanged translation result for "${text.substring(0, 30)}..."`);
          setTranslatedText(text); // Fallback to original if result is empty
          
          // If we got the same text back and it's not English, consider it a failure
          if (currentLanguage !== 'en' && text.length > 3) {
            setTranslationFailed(true);
            
            // Auto-retry once after a delay if this looks like a translation failure
            if (retryAttemptsRef.current === 0) {
              retryAttemptsRef.current++;
              setTimeout(() => {
                if (mountedRef.current) {
                  console.log(`TranslatableText: Auto-retrying translation for "${text.substring(0, 30)}..."`);
                  translateText(true);
                }
              }, 2000);
            }
          }
        }
      }
    } catch (error) {
      console.error(`TranslatableText: Translation error for "${text.substring(0, 30)}..."`, error);
      if (mountedRef.current && prevLangRef.current === currentLanguage && textRef.current === text) {
        setTranslatedText(text); // Fallback to original
        setTranslationFailed(true);
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
    retryAttemptsRef.current = 0;

    const handleTranslation = async () => {
      if (mountedRef.current) {
        await translateText(false); // Normal translation, not forced
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
      retryAttemptsRef.current = 0;
      
      // Then retranslate
      translateText(false);
    };
    
    // Listen for global translation updates
    const handleTranslationsUpdated = () => {
      // Only retry if this component had a failed translation
      if (translationFailed) {
        console.log(`TranslatableText: Translations updated event for failed translation "${text.substring(0, 30)}..."`);
        translateText(true);
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    window.addEventListener('translationsUpdated', handleTranslationsUpdated as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
      window.removeEventListener('translationsUpdated', handleTranslationsUpdated as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage, translationFailed]);

  // Handle manual retry on click for failed translations in Hindi
  const handleClick = () => {
    if (translationFailed && currentLanguage === 'hi') {
      console.log(`TranslatableText: Manual retry for "${text.substring(0, 30)}..."`);
      translateText(true);
    }
  };

  // Using React.createElement to avoid type confusion with Three.js components
  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''} ${translationFailed ? 'cursor-pointer border-b border-dotted border-red-300' : ''}`.trim(),
      'data-translating': isLoading ? 'true' : 'false',
      'data-translated': translatedText !== text ? 'true' : 'false',
      'data-lang': currentLanguage,
      'data-force-translate': forceTranslate ? 'true' : 'false',
      'data-failed': translationFailed ? 'true' : 'false',
      onClick: handleClick,
      title: translationFailed ? "Translation failed. Click to retry." : undefined,
      style // Pass style prop to the element
    }, 
    translatedText || text  // Ensure we always show something, even if translation fails
  );
}

export default TranslatableText;
