
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
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
  }, [text, currentLanguage, translate, isOnWebsite]);

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
