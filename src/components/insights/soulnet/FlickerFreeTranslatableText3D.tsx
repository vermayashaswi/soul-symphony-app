
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { SoulNetTranslationPreloader } from '@/services/soulnetTranslationPreloader';
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
  const { currentLanguage } = useTranslation();
  const [finalText, setFinalText] = useState<string | null>(null);
  const [isStable, setIsStable] = useState<boolean>(false);

  // ENHANCED: Get translated text without any English fallbacks
  const translatedText = useMemo(() => {
    if (!text) {
      return null;
    }

    // If same language, return original text immediately
    if (currentLanguage === sourceLanguage) {
      return text;
    }

    if (!userId || !timeRange) {
      console.log(`[FlickerFreeTranslatableText3D] Missing userId or timeRange for translation: "${text}"`);
      return null;
    }

    // STRICT: Get preloaded translation - NO FALLBACK to English
    const preloadedTranslation = SoulNetTranslationPreloader.getTranslationSync(
      text, 
      currentLanguage, 
      userId, 
      timeRange
    );

    if (preloadedTranslation) {
      console.log(`[FlickerFreeTranslatableText3D] FOUND TRANSLATION: "${text}" -> "${preloadedTranslation}"`);
      return preloadedTranslation;
    }

    console.log(`[FlickerFreeTranslatableText3D] NO TRANSLATION AVAILABLE: "${text}" in ${currentLanguage}`);
    return null;
  }, [text, currentLanguage, sourceLanguage, userId, timeRange]);

  // ENHANCED: Update final text only when translation actually changes
  useEffect(() => {
    if (translatedText !== finalText) {
      console.log(`[FlickerFreeTranslatableText3D] TRANSLATION CHANGE: "${finalText}" -> "${translatedText}"`);
      setIsStable(false);
      
      // Short delay to prevent rapid flashing during language switches
      const timer = setTimeout(() => {
        setFinalText(translatedText);
        setIsStable(true);
        if (translatedText) {
          onTranslationComplete?.(translatedText);
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [translatedText, finalText, onTranslationComplete]);

  // STRICT: Only render if we have a valid translation and stable state
  if (!visible || !isStable || !finalText) {
    if (!finalText && currentLanguage !== sourceLanguage) {
      console.log(`[FlickerFreeTranslatableText3D] HIDING NODE: No translation for "${text}" in ${currentLanguage}`);
    }
    return null;
  }

  console.log(`[FlickerFreeTranslatableText3D] RENDERING: "${finalText}" at size ${size}`);

  return (
    <SmartTextRenderer
      text={finalText}
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
