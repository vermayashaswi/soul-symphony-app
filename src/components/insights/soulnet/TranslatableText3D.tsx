
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
  onTranslationComplete
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

      // PRIORITY 1: Check for pre-cached translation first (from SoulNet preload)
      const cachedTranslation = getCachedTranslation(text);
      if (cachedTranslation) {
        console.log(`[TranslatableText3D] Using pre-cached translation for "${text}": "${cachedTranslation}"`);
        setTranslatedText(cachedTranslation);
        onTranslationComplete?.(cachedTranslation);
        return;
      }

      if (!translate) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      console.log(`[TranslatableText3D] No cache found, translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        const result = await translate(text, sourceLanguage);
        
        if (result && result !== text) {
          console.log(`[TranslatableText3D] Translation successful: "${text}" -> "${result}"`);
          setTranslatedText(result);
          onTranslationComplete?.(result);
        } else {
          console.log(`[TranslatableText3D] Using original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        }
      } catch (error) {
        console.error(`[TranslatableText3D] Translation failed for "${text}":`, error);
        setTranslatedText(text);
        onTranslationComplete?.(text);
      } finally {
        setIsTranslating(false);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete]);

  // Don't render while translating to prevent flicker
  if (isTranslating) {
    return null;
  }

  return (
    <SmartTextRenderer
      text={translatedText}
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
      maxCharsPerLine={maxCharsPerLine}
      maxLines={maxLines}
    />
  );
};

export default TranslatableText3D;
