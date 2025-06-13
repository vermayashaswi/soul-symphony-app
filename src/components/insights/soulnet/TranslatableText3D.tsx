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
  // ENHANCED: Atomic coordinated translation props
  coordinatedTranslation?: string;
  useCoordinatedTranslation?: boolean;
  isAtomicMode?: boolean;
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
  coordinatedTranslation,
  useCoordinatedTranslation = false,
  isAtomicMode = true
}) => {
  const { currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);

  useEffect(() => {
    // ENHANCED: STRICT ATOMIC - Only use coordinated translations, never fallback
    if (useCoordinatedTranslation && coordinatedTranslation && isAtomicMode) {
      console.log(`[TranslatableText3D] ATOMIC-STRICT: Using atomic coordinated translation for "${text}": "${coordinatedTranslation}"`);
      setTranslatedText(coordinatedTranslation);
      onTranslationComplete?.(coordinatedTranslation);
      return;
    }

    if (!text || currentLanguage === sourceLanguage) {
      setTranslatedText(text);
      onTranslationComplete?.(text);
      return;
    }

    // ENHANCED: In atomic mode, ALWAYS use original text if no coordinated translation
    if (useCoordinatedTranslation && isAtomicMode) {
      console.log(`[TranslatableText3D] ATOMIC-STRICT: No coordinated translation for "${text}", using original text to maintain atomic consistency`);
      setTranslatedText(text);
      onTranslationComplete?.(text);
      return;
    }

    // ENHANCED: For non-atomic usage, use original text (no individual translations)
    console.log(`[TranslatableText3D] ATOMIC-STRICT: Using original text for "${text}" (atomic mode: ${isAtomicMode})`);
    setTranslatedText(text);
    onTranslationComplete?.(text);
  }, [text, currentLanguage, sourceLanguage, onTranslationComplete, coordinatedTranslation, useCoordinatedTranslation, isAtomicMode]);

  // ENHANCED: Always render with current text - maintain atomic consistency
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
