
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { isWebsiteRoute } from '@/routes/RouteHelpers';

interface TranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function TranslatableText({ 
  text, 
  className = "",
  as: Component = 'span' 
}: TranslatableTextProps) {
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const { t } = useI18nTranslation();
  const location = useLocation();
  
  // Determine if we're on a website route (marketing site)
  const isOnWebsite = isWebsiteRoute(location.pathname);

  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (!text?.trim()) {
        if (isMounted) setTranslatedText('');
        return;
      }

      // Skip translations for the marketing website pages
      if (isOnWebsite) {
        if (isMounted) setTranslatedText(text);
        return;
      }

      // Check if this is a translation key (contains dots or is in the form of a key)
      const isTranslationKey = text.includes('.') || !text.includes(' ');
      
      if (isTranslationKey) {
        try {
          // Try to use i18next first
          const i18nResult = t(text);
          
          // If it returns the key itself, then it's not found in i18n
          if (i18nResult !== text) {
            if (isMounted) setTranslatedText(i18nResult);
            return;
          }
        } catch (error) {
          console.warn(`TranslatableText: i18n key not found: "${text}"`);
        }
      }

      // Fallback to dynamic translation service if not in English
      if (currentLanguage !== 'en') {
        setIsLoading(true);
        console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage}`);

        try {
          const result = await translate(text);
          if (isMounted) {
            setTranslatedText(result);
            console.log(`TranslatableText: Successfully translated to "${result.substring(0, 30)}..."`);
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
      } else {
        if (isMounted) setTranslatedText(text);
      }
    };

    translateText();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate, t, isOnWebsite]);

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
