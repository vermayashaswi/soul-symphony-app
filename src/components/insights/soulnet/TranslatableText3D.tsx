
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
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const translateText = async () => {
      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      if (!translate) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      console.log(`[TranslatableText3D] Translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        setHasError(false);
        
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
        setHasError(true);
        setTranslatedText(text);
        onTranslationComplete?.(text);
      } finally {
        setIsTranslating(false);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, onTranslationComplete]);

  // Show original text if translating to prevent flickering
  const displayText = isTranslating ? text : translatedText;

  return (
    <SmartTextRenderer
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
      maxCharsPerLine={maxCharsPerLine}
      maxLines={maxLines}
    />
  );
};

export default TranslatableText3D;
