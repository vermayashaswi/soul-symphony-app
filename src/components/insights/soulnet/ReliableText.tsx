
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';
import SimpleText from './SimpleText';

interface ReliableTextProps {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  visible?: boolean;
  renderOrder?: number;
  bold?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  maxWidth?: number;
  enableWrapping?: boolean;
}

export const ReliableText: React.FC<ReliableTextProps> = ({
  text,
  position,
  color = '#ffffff',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0.02,
  outlineColor = '#333333',
  maxWidth = 25,
  enableWrapping = false
}) => {
  const { currentLanguage, translate, getCachedTranslation } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Enhanced translation lookup with multiple fallback sources
  const getTranslatedText = useMemo(() => {
    return async (inputText: string): Promise<string> => {
      if (!inputText || currentLanguage === 'en') {
        return inputText;
      }

      console.log(`[ReliableText] Getting translation for "${inputText}" (${currentLanguage})`);

      // 1. Check translation context cache first
      const contextCached = getCachedTranslation ? getCachedTranslation(inputText) : null;
      if (contextCached) {
        console.log(`[ReliableText] Found in context cache: "${inputText}" -> "${contextCached}"`);
        return contextCached;
      }

      // 2. Check on-demand translation cache
      const onDemandCached = onDemandTranslationCache.get(currentLanguage, inputText);
      if (onDemandCached) {
        console.log(`[ReliableText] Found in on-demand cache: "${inputText}" -> "${onDemandCached}"`);
        return onDemandCached;
      }

      // 3. Attempt real-time translation as last resort
      if (translate) {
        try {
          setIsTranslating(true);
          console.log(`[ReliableText] Attempting real-time translation: "${inputText}"`);
          const translated = await translate(inputText, 'en');
          
          if (translated && translated !== inputText) {
            console.log(`[ReliableText] Real-time translation successful: "${inputText}" -> "${translated}"`);
            return translated;
          } else {
            console.log(`[ReliableText] Real-time translation returned same text: "${inputText}"`);
          }
        } catch (error) {
          console.warn(`[ReliableText] Real-time translation failed for "${inputText}":`, error);
        } finally {
          setIsTranslating(false);
        }
      }

      // 4. Final fallback to original text
      console.log(`[ReliableText] Using fallback text: "${inputText}"`);
      return inputText;
    };
  }, [currentLanguage, translate, getCachedTranslation]);

  // Handle translation with proper cleanup
  useEffect(() => {
    let isMounted = true;

    const translateText = async () => {
      if (!text || !isMounted) return;
      
      try {
        const translatedText = await getTranslatedText(text);
        if (isMounted && translatedText) {
          setDisplayText(translatedText);
        }
      } catch (error) {
        console.error(`[ReliableText] Translation error for "${text}":`, error);
        if (isMounted) {
          setDisplayText(text); // Fallback to original
        }
      }
    };

    translateText();

    return () => {
      isMounted = false;
    };
  }, [text, getTranslatedText]);

  if (!visible) {
    return null;
  }

  console.log(`[ReliableText] Rendering: "${displayText}" (original: "${text}", lang: ${currentLanguage}, translating: ${isTranslating})`);

  return (
    <SimpleText
      text={displayText}
      position={position}
      color={color}
      size={size}
      visible={visible}
      renderOrder={renderOrder}
      bold={bold}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      maxWidth={maxWidth}
      enableWrapping={enableWrapping}
    />
  );
};

export default ReliableText;
