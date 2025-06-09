
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLocation } from 'react-router-dom';
import { translationStabilityService } from '@/services/translationStabilityService';

interface StableTranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  sourceLanguage?: string;
  entryId?: number;
  forceTranslate?: boolean;
  onTranslationStart?: () => void;
  onTranslationEnd?: () => void;
  style?: React.CSSProperties;
  timeRange?: string; // Added to track current time view
}

export function StableTranslatableText({ 
  text, 
  className = "",
  as: Component = 'span',
  sourceLanguage = 'en',
  entryId,
  forceTranslate = false,
  onTranslationStart,
  onTranslationEnd,
  style,
  timeRange = 'week'
}: StableTranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const location = useLocation();
  const currentLanguageRef = useRef<string>(currentLanguage);
  const route = location.pathname;

  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };
  
  const translateText = async () => {
    if (!text?.trim()) {
      setTranslatedText('');
      return;
    }

    // Don't translate if already in the target language
    if (currentLanguage === sourceLanguage) {
      setTranslatedText(text);
      return;
    }

    // Check if translations are locked for this view
    if (translationStabilityService.isTranslationLocked(currentLanguage, route, timeRange)) {
      console.log(`[StableTranslatableText] Translations locked for ${currentLanguage}_${route}_${timeRange}, using persistent state`);
      
      // Get persistent state
      const persistentState = translationStabilityService.getTranslationState(text, currentLanguage, route, timeRange);
      if (persistentState) {
        setTranslatedText(persistentState.translatedText);
        return;
      }

      // Fallback to last known translation across views
      const fallbackTranslation = translationStabilityService.getLastTranslatedText(text, currentLanguage);
      if (fallbackTranslation) {
        console.log(`[StableTranslatableText] Using fallback translation for "${text.substring(0, 30)}"`);
        setTranslatedText(fallbackTranslation);
        return;
      }
    }

    // Check for existing persistent state first
    const existingState = translationStabilityService.getTranslationState(text, currentLanguage, route, timeRange);
    if (existingState) {
      console.log(`[StableTranslatableText] Using persistent state for "${text.substring(0, 30)}"`);
      setTranslatedText(existingState.translatedText);
      return;
    }

    // Check if we have a fallback from other views
    const fallbackTranslation = translationStabilityService.getLastTranslatedText(text, currentLanguage);
    if (fallbackTranslation) {
      console.log(`[StableTranslatableText] Using cross-view fallback for "${text.substring(0, 30)}"`);
      setTranslatedText(fallbackTranslation);
      // Store this as the state for current view too
      translationStabilityService.setTranslationState(text, fallbackTranslation, currentLanguage, route, timeRange, sourceLanguage);
      return;
    }

    // Only translate if we don't have any existing state and translations aren't locked
    if (!translationStabilityService.isTranslationLocked(currentLanguage, route, timeRange)) {
      console.log(`[StableTranslatableText] Performing new translation for "${text.substring(0, 30)}"`);
      
      if (!isLoading) {
        setIsLoading(true);
        if (onTranslationStart) {
          onTranslationStart();
        }
      }
        
      try {
        const result = await translate(text, sourceLanguage, entryId);
        
        if (result) {
          const cleanedResult = cleanTranslationResult(result);
          setTranslatedText(cleanedResult || text);
          
          // Store the translation state
          translationStabilityService.setTranslationState(text, cleanedResult || text, currentLanguage, route, timeRange, sourceLanguage);
          
          // Check if we have enough translations to mark this view as stable
          translationStabilityService.checkViewStability(currentLanguage, route, timeRange);
        } else {
          setTranslatedText(text);
        }
      } catch (error) {
        console.error(`[StableTranslatableText] Translation error for "${text.substring(0, 30)}"`, error);
        setTranslatedText(text);
      } finally {
        setIsLoading(false);
        if (onTranslationEnd) {
          onTranslationEnd();
        }
      }
    } else {
      // If locked but no state, use original
      setTranslatedText(text);
    }
  };

  useEffect(() => {
    // Only retranslate if language actually changed
    const languageChanged = currentLanguageRef.current !== currentLanguage;
    if (languageChanged) {
      currentLanguageRef.current = currentLanguage;
      console.log(`[StableTranslatableText] Language changed to ${currentLanguage}, clearing locks`);
      translationStabilityService.unlockAllTranslations();
    }

    translateText();
  }, [text, currentLanguage, sourceLanguage, entryId, forceTranslate, route, timeRange]);
  
  useEffect(() => {
    const handleLanguageChangeEvent = () => {
      console.log(`[StableTranslatableText] Language change event received`);
      translationStabilityService.unlockAllTranslations();
      currentLanguageRef.current = currentLanguage;
      translateText();
    };
    
    window.addEventListener('languageChange', handleLanguageChangeEvent as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChangeEvent as EventListener);
    };
  }, [text, sourceLanguage, entryId, currentLanguage, forceTranslate]);

  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim(),
      'data-translating': isLoading ? 'true' : 'false',
      'data-translated': translatedText !== text ? 'true' : 'false',
      'data-lang': currentLanguage,
      style
    }, 
    translatedText || text
  );
}

export default StableTranslatableText;
