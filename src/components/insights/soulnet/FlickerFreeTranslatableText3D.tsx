
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [hasError, setHasError] = useState<boolean>(false);

  // Memoized translation lookup with error handling
  const translatedText = useMemo(() => {
    try {
      if (!text) {
        console.warn('[FlickerFreeTranslatableText3D] Empty text provided');
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

      // Get preloaded translation - NO FALLBACK to English
      const preloadedTranslation = SoulNetTranslationPreloader.getTranslationSync(
        text, 
        currentLanguage, 
        userId, 
        timeRange
      );

      if (preloadedTranslation && preloadedTranslation !== text) {
        console.log(`[FlickerFreeTranslatableText3D] FOUND TRANSLATION: "${text}" -> "${preloadedTranslation}"`);
        setHasError(false);
        return preloadedTranslation;
      }

      console.log(`[FlickerFreeTranslatableText3D] NO TRANSLATION AVAILABLE: "${text}" in ${currentLanguage}`);
      return null;
    } catch (error) {
      console.error(`[FlickerFreeTranslatableText3D] Error in translation lookup:`, error);
      setHasError(true);
      return null;
    }
  }, [text, currentLanguage, sourceLanguage, userId, timeRange]);

  // Stable text update with error recovery
  const updateFinalText = useCallback((newText: string | null) => {
    if (newText !== finalText) {
      console.log(`[FlickerFreeTranslatableText3D] TRANSLATION CHANGE: "${finalText}" -> "${newText}"`);
      setIsStable(false);
      
      // Immediate update for English or when switching back to source language
      if (currentLanguage === sourceLanguage) {
        setFinalText(newText);
        setIsStable(true);
        if (newText) {
          onTranslationComplete?.(newText);
        }
        return;
      }
      
      // Short delay to prevent rapid flashing during language switches
      const timer = setTimeout(() => {
        setFinalText(newText);
        setIsStable(true);
        if (newText) {
          onTranslationComplete?.(newText);
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [finalText, currentLanguage, sourceLanguage, onTranslationComplete]);

  // Update final text when translation changes
  useEffect(() => {
    const cleanup = updateFinalText(translatedText);
    return cleanup;
  }, [translatedText, updateFinalText]);

  // Error recovery mechanism
  useEffect(() => {
    if (hasError) {
      console.log(`[FlickerFreeTranslatableText3D] Attempting error recovery for: "${text}"`);
      const timer = setTimeout(() => {
        setHasError(false);
        setIsStable(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasError, text]);

  // Only render if we have a valid translation and stable state
  if (!visible || !isStable || !finalText || hasError) {
    if (!finalText && currentLanguage !== sourceLanguage && !hasError) {
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
