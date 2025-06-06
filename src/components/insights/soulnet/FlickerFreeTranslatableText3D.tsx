
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

  // Get translated text without fallbacks - returns null if no translation available
  const translatedText = useMemo(() => {
    if (!text) {
      return null;
    }

    // If same language, return original text
    if (currentLanguage === sourceLanguage) {
      return text;
    }

    if (!userId || !timeRange) {
      console.log(`[FlickerFreeTranslatableText3D] Missing userId or timeRange, cannot get translation for: "${text}"`);
      return null;
    }

    // Try to get preloaded translation - NO FALLBACK to original text
    const preloadedTranslation = SoulNetTranslationPreloader.getTranslationSync(
      text, 
      currentLanguage, 
      userId, 
      timeRange
    );

    if (preloadedTranslation) {
      console.log(`[FlickerFreeTranslatableText3D] Using preloaded translation: "${text}" -> "${preloadedTranslation}"`);
      return preloadedTranslation;
    }

    console.log(`[FlickerFreeTranslatableText3D] NO TRANSLATION AVAILABLE for: "${text}" in ${currentLanguage}`);
    return null;
  }, [text, currentLanguage, sourceLanguage, userId, timeRange]);

  // Update final text only when translation actually changes
  useEffect(() => {
    if (translatedText !== finalText) {
      console.log(`[FlickerFreeTranslatableText3D] Text updated: "${finalText}" -> "${translatedText}"`);
      setIsStable(false);
      
      // Use a short delay to batch updates and prevent rapid flashing
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

  // Don't render if no translation is available or not stable
  if (!visible || !isStable || !finalText) {
    if (!finalText) {
      console.log(`[FlickerFreeTranslatableText3D] NOT RENDERING - no translation available for: "${text}"`);
    }
    return null;
  }

  console.log(`[FlickerFreeTranslatableText3D] Rendering stable text: "${finalText}" at size ${size}`);

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
