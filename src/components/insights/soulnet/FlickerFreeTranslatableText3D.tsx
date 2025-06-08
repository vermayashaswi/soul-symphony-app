
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import SmartTextRenderer from './SmartTextRenderer';

interface FlickerFreeTranslatableText3DProps {
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
  userId?: string;
  timeRange?: string;
  sourceLanguage?: string;
  onTranslationComplete?: (translatedText: string) => void;
}

export const FlickerFreeTranslatableText3D: React.FC<FlickerFreeTranslatableText3DProps> = ({
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
  userId,
  timeRange,
  sourceLanguage = 'en',
  onTranslationComplete
}) => {
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Use GoogleWebTranslate approach instead of preloader
  useEffect(() => {
    const translateText = async () => {
      if (!text) {
        setIsReady(false);
        return;
      }

      // If same language, use original text immediately
      if (currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        setIsReady(true);
        onTranslationComplete?.(text);
        return;
      }

      if (!translate) {
        console.log(`[FlickerFreeTranslatableText3D] No translate function available for "${text}"`);
        setTranslatedText(text);
        setIsReady(true);
        onTranslationComplete?.(text);
        return;
      }

      try {
        console.log(`[FlickerFreeTranslatableText3D] Translating "${text}" to ${currentLanguage}`);
        
        const result = await translate(text, sourceLanguage);
        
        if (result && result !== text) {
          console.log(`[FlickerFreeTranslatableText3D] Translation successful: "${text}" -> "${result}"`);
          setTranslatedText(result);
          onTranslationComplete?.(result);
        } else {
          console.log(`[FlickerFreeTranslatableText3D] Using original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        }
        
        setIsReady(true);
      } catch (error) {
        console.error(`[FlickerFreeTranslatableText3D] Translation failed for "${text}":`, error);
        setTranslatedText(text);
        setIsReady(true);
        onTranslationComplete?.(text);
      }
    };

    setIsReady(false);
    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, onTranslationComplete]);

  // Only render when translation is ready
  if (!visible || !isReady || !translatedText) {
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

export default FlickerFreeTranslatableText3D;
