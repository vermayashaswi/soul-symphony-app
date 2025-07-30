import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '@/contexts/TranslationContext';
import { useLanguageFontConfig } from '@/utils/languageFontScaling';
import { cn } from '@/lib/utils';
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation';

// Import page-specific translation hooks
import { useHomeTranslation } from './HomeTranslationProvider';
import { useJournalTranslation } from './JournalTranslationProvider';
import { useChatTranslation } from './ChatTranslationProvider';
import { useSettingsTranslation } from './SettingsTranslationProvider';
import { useInsightsTranslation } from '../insights/InsightsTranslationProvider';

interface UniversalTranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  sourceLanguage?: string;
  entryId?: number;
  forceTranslate?: boolean;
  onTranslationStart?: () => void;
  onTranslationEnd?: () => void;
  style?: React.CSSProperties;
  enableFontScaling?: boolean;
  scalingContext?: string;
  fallbackToDynamic?: boolean; // Whether to fall back to dynamic translation
}

export const UniversalTranslatableText: React.FC<UniversalTranslatableTextProps> = ({
  text,
  className = '',
  as: Component = 'span',
  sourceLanguage = 'en',
  entryId,
  forceTranslate = false,
  onTranslationStart,
  onTranslationEnd,
  style = {},
  enableFontScaling = true,
  scalingContext = 'default',
  fallbackToDynamic = true
}) => {
  const location = useLocation();
  const { currentLanguage } = useTranslation();
  const fontConfig = useLanguageFontConfig(currentLanguage);
  const dynamicTranslation = useDynamicTranslation();
  
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isLoading, setIsLoading] = useState(false);
  const prevTextRef = useRef<string>(text);
  const prevLanguageRef = useRef<string>(currentLanguage);

  // Function to get page-specific translation
  const getPageTranslation = (textToTranslate: string): string | null => {
    try {
      const pathname = location.pathname;
      
      if (pathname.includes('/home')) {
        const homeTranslation = useHomeTranslation();
        return homeTranslation?.getTranslation(textToTranslate) || null;
      } else if (pathname.includes('/journal')) {
        const journalTranslation = useJournalTranslation();
        return journalTranslation?.getTranslation(textToTranslate) || null;
      } else if (pathname.includes('/chat') || pathname.includes('/smart-chat')) {
        const chatTranslation = useChatTranslation();
        return chatTranslation?.getTranslation(textToTranslate) || null;
      } else if (pathname.includes('/settings')) {
        const settingsTranslation = useSettingsTranslation();
        return settingsTranslation?.getTranslation(textToTranslate) || null;
      } else if (pathname.includes('/insights')) {
        const insightsTranslation = useInsightsTranslation();
        return insightsTranslation?.getTranslation(textToTranslate) || null;
      }
    } catch (error) {
      // Page-specific context not available
    }
    
    return null;
  };

  const handleTranslation = async () => {
    if (!text || text.trim() === '') return;

    // Skip translation for English or if source and target languages match
    if (currentLanguage === 'en' || currentLanguage === sourceLanguage) {
      setTranslatedText(text);
      return;
    }

    // First, try to get translation from page-specific cache
    const pageTranslation = getPageTranslation(text);
    if (pageTranslation) {
      setTranslatedText(pageTranslation);
      return;
    }

    // Next, try dynamic translation cache
    if (dynamicTranslation.hasTranslation(text)) {
      const cachedTranslation = dynamicTranslation.getTranslatedText(text);
      setTranslatedText(cachedTranslation);
      return;
    }

    // If fallback to dynamic is enabled and no cached translation exists
    if (fallbackToDynamic && !dynamicTranslation.isTextBeingTranslated(text)) {
      setIsLoading(true);
      onTranslationStart?.();
      
      // Request dynamic translation
      await dynamicTranslation.requestTranslation([text]);
      
      // Check if translation completed
      if (dynamicTranslation.hasTranslation(text)) {
        const newTranslation = dynamicTranslation.getTranslatedText(text);
        setTranslatedText(newTranslation);
      }
      
      setIsLoading(false);
      onTranslationEnd?.();
    }
  };

  // Effect for initial translation and updates
  useEffect(() => {
    const textChanged = prevTextRef.current !== text;
    const languageChanged = prevLanguageRef.current !== currentLanguage;

    if (textChanged || languageChanged || forceTranslate) {
      handleTranslation();
      prevTextRef.current = text;
      prevLanguageRef.current = currentLanguage;
    }
  }, [text, currentLanguage, forceTranslate]);

  // Listen for language change events
  useEffect(() => {
    const handleLanguageChange = () => {
      handleTranslation();
    };

    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, [text]);

  // Generate language-aware classes and styles
  const getLanguageAwareClasses = () => {
    if (!enableFontScaling) return className;
    
    const fontClasses = fontConfig?.classes || '';
    
    return cn(className, fontClasses);
  };

  const createLanguageAwareStyle = () => {
    if (!enableFontScaling) return style;
    
    return {
      ...style,
      ...(fontConfig?.cssProps || {})
    };
  };

  // Apply contextual styles for specific scaling contexts
  const contextualStyles = scalingContext === 'mobile-nav' ? {
    fontSize: currentLanguage === 'hi' || currentLanguage === 'ta' ? '0.85rem' : undefined
  } : {};

  const finalStyle = {
    ...createLanguageAwareStyle(),
    ...contextualStyles
  };

  const finalClassName = getLanguageAwareClasses();

  return React.createElement(
    Component,
    {
      className: finalClassName,
      style: finalStyle,
      'data-translating': isLoading,
      'data-translated': translatedText !== text,
      'data-scaling-context': scalingContext,
      'data-language': currentLanguage
    },
    isLoading ? text : translatedText
  );
};