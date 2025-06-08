
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import SmartTextRenderer from './SmartTextRenderer';

interface RobustTranslatableText3DProps {
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
  retryKey?: number;
}

export const RobustTranslatableText3D: React.FC<RobustTranslatableText3DProps> = ({
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
  retryKey = 0
}) => {
  const { currentLanguage, translate } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(text);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Robust text validation - accept any non-empty string
  const isValidText = useMemo(() => {
    return text && typeof text === 'string' && text.trim().length > 0;
  }, [text]);

  console.log(`[RobustTranslatableText3D] Processing: "${text}" (${sourceLanguage} -> ${currentLanguage}), valid: ${isValidText}, retry: ${retryKey}`);

  useEffect(() => {
    const translateText = async () => {
      if (!isValidText) {
        console.log(`[RobustTranslatableText3D] Invalid text: "${text}"`);
        setIsReady(false);
        return;
      }

      try {
        // For same language or English, use original text
        if (currentLanguage === sourceLanguage || currentLanguage === 'en') {
          console.log(`[RobustTranslatableText3D] Using original text for same language: ${currentLanguage}`);
          setDisplayText(text);
          setIsReady(true);
          onTranslationComplete?.(text);
          return;
        }

        if (!translate) {
          console.log(`[RobustTranslatableText3D] No translate function available`);
          setDisplayText(text);
          setIsReady(true);
          onTranslationComplete?.(text);
          return;
        }

        console.log(`[RobustTranslatableText3D] Starting translation: "${text}" to ${currentLanguage}`);
        setIsReady(false);
        
        const result = await translate(text, sourceLanguage);
        
        if (result && typeof result === 'string' && result.trim().length > 0) {
          console.log(`[RobustTranslatableText3D] Translation successful: "${text}" -> "${result}"`);
          setDisplayText(result);
          onTranslationComplete?.(result);
        } else {
          console.log(`[RobustTranslatableText3D] Translation returned invalid result, using original`);
          setDisplayText(text);
          onTranslationComplete?.(text);
        }
        
        setIsReady(true);
      } catch (error) {
        console.error(`[RobustTranslatableText3D] Translation failed for "${text}":`, error);
        setDisplayText(text);
        setIsReady(true);
        onTranslationComplete?.(text);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, onTranslationComplete, isValidText, retryKey]);

  // Only render when ready and text is valid
  if (!visible || !isReady || !isValidText || !displayText) {
    return null;
  }

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

export default RobustTranslatableText3D;
