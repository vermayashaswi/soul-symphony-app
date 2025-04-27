
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { translate, currentLanguage } = useTranslation();

  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (currentLanguage === 'en') {
        // No need to translate English
        if (isMounted) setTranslatedText(text);
        return;
      }

      try {
        const result = await translate(text);
        if (isMounted) setTranslatedText(result);
      } catch (error) {
        console.error('Translation error:', error);
        if (isMounted) setTranslatedText(text); // Fallback to original
      }
    };

    translateText();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate]);

  // The error was happening here - we're rendering the Component with children and className
  // but TypeScript is confusing it with a Three.js texture that requires a 'map' prop
  // Fix: Explicitly specify the element type to avoid type confusion
  return React.createElement(Component, { className }, translatedText);
}

export default TranslatableText;
