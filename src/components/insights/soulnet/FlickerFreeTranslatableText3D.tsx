
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
  const [finalText, setFinalText] = useState<string>(text);
  const [isStable, setIsStable] = useState<boolean>(true);

  // Memoize the translated text to prevent unnecessary re-renders
  const translatedText = useMemo(() => {
    if (!text || currentLanguage === sourceLanguage) {
      return text;
    }

    if (!userId || !timeRange) {
      return text;
    }

    // Try to get preloaded translation
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

    console.log(`[FlickerFreeTranslatableText3D] No preloaded translation found for: "${text}", using original`);
    return text;
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
        onTranslationComplete?.(translatedText);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [translatedText, finalText, onTranslationComplete]);

  // Only render when stable to prevent flicker
  if (!visible || !isStable) {
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
