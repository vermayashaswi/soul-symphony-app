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
  
  const isOnWebsite = isWebsiteRoute(location.pathname);

  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (!text?.trim() || isOnWebsite || currentLanguage === 'en') {
        if (isMounted) setTranslatedText(text || '');
        return;
      }
      
      setIsLoading(true);
      console.log(`TranslatableText: Translating "${text.substring(0, 30)}..." to ${currentLanguage}`);

      try {
        const result = await translate(text);
        if (isMounted && result && result.trim() !== '') {
          setTranslatedText(result);
          console.log(`TranslatableText: Successfully translated to "${result.substring(0, 30)}..."`);
        } else {
          console.log(`TranslatableText: Translation empty, keeping original text`);
        }
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (text !== translatedText && currentLanguage !== 'en') {
      translateText();
    } else if (text && text !== translatedText) {
      setTranslatedText(text);
    }

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate, isOnWebsite, translatedText]);
  
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      console.log(`TranslatableText: Language change event detected: ${event.detail.language}`);
      
      if (currentLanguage !== 'en' && text && text.trim() !== '') {
        setIsLoading(true);
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [currentLanguage, text]);

  return React.createElement(
    Component, 
    { 
      className: `${className} ${isLoading ? 'opacity-70' : ''}`.trim()
    }, 
    translatedText || text || ""
  );
}

export default TranslatableText;
