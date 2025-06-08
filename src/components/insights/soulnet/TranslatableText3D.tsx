
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import SmartTextRenderer from './SmartTextRenderer';

interface TranslatableText3DProps {
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
  maxCharsPerLine?: number;
  maxLines?: number;
  sourceLanguage?: string;
  onTranslationComplete?: (translatedText: string) => void;
  getInstantTranslation?: (text: string) => string;
  isInstantReady?: boolean;
}

export const TranslatableText3D: React.FC<TranslatableText3DProps> = ({
  text,
  position,
  color = '#000000',
  size = 0.4,
  visible = true,
  renderOrder = 10,
  bold = false,
  outlineWidth = 0,
  outlineColor,
  maxWidth = 25,
  enableWrapping = false,
  maxCharsPerLine = 18,
  maxLines = 3,
  sourceLanguage = 'en',
  onTranslationComplete,
  getInstantTranslation,
  isInstantReady = false
}) => {
  const { currentLanguage, getCachedTranslation, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateText = async () => {
      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      // ENHANCED PRIORITY 1: Use instant translation if available and ready
      if (getInstantTranslation && isInstantReady) {
        const instantTranslation = getInstantTranslation(text);
        console.log(`[TranslatableText3D] Using enhanced instant translation for "${text}": "${instantTranslation}"`);
        setTranslatedText(instantTranslation);
        onTranslationComplete?.(instantTranslation);
        return;
      }

      // ENHANCED PRIORITY 2: Check for pre-cached translation
      const cachedTranslation = getCachedTranslation(text);
      if (cachedTranslation) {
        console.log(`[TranslatableText3D] Using enhanced pre-cached translation for "${text}": "${cachedTranslation}"`);
        setTranslatedText(cachedTranslation);
        onTranslationComplete?.(cachedTranslation);
        return;
      }

      // ENHANCED PRIORITY 3: Non-blocking background translation
      if (!translate) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      console.log(`[TranslatableText3D] Enhanced fallback translation for "${text}" from ${sourceLanguage} to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        const result = await translate(text, sourceLanguage);
        
        if (result && result !== text) {
          console.log(`[TranslatableText3D] Enhanced translation successful: "${text}" -> "${result}"`);
          setTranslatedText(result);
          onTranslationComplete?.(result);
        } else {
          console.log(`[TranslatableText3D] Enhanced fallback to original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        }
      } catch (error) {
        console.error(`[TranslatableText3D] Enhanced translation failed for "${text}":`, error);
        setTranslatedText(text);
        onTranslationComplete?.(text);
      } finally {
        setIsTranslating(false);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete, getInstantTranslation, isInstantReady]);

  // Enhanced rendering with instant fallback - no loading delays
  return (
    <SmartTextRenderer
      text={translatedText}
      position={position}
      color={isTranslating ? '#888888' : color}
      size={size}
      visible={visible}
      renderOrder={renderOrder}
      bold={bold}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      maxWidth={maxWidth}
      enableWrapping={enableWrapping}
      maxCharsPerLine={maxCharsPerLine}
      maxLines={maxLines}
    />
  );
};

export default TranslatableText3D;
