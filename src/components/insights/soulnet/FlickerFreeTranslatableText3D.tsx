
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

// ENHANCED: Text validation utilities
function isValidDisplayText(text: string): boolean {
  return typeof text === 'string' && 
         text.trim().length > 0 && 
         text.trim() !== 'undefined' && 
         text.trim() !== 'null' &&
         text.trim() !== 'NaN';
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
  const [isStable, setIsStable] = useState<boolean>(false);
  const [translationAttempted, setTranslationAttempted] = useState<boolean>(false);

  // ENHANCED: Comprehensive text validation and translation lookup
  const translatedText = useMemo(() => {
    try {
      // ENHANCED: Validate input text
      if (!isValidDisplayText(text)) {
        console.warn(`[FlickerFreeTranslatableText3D] Invalid text provided: "${text}"`);
        return text; // Return as-is for invalid texts
      }

      // If same language, return original text immediately
      if (currentLanguage === sourceLanguage) {
        return text;
      }

      // Try to get preloaded translation
      if (userId && timeRange) {
        const preloadedTranslation = SoulNetTranslationPreloader.getTranslationSync(
          text, 
          currentLanguage, 
          userId, 
          timeRange
        );

        if (preloadedTranslation && isValidDisplayText(preloadedTranslation) && preloadedTranslation !== text) {
          console.log(`[FlickerFreeTranslatableText3D] TRANSLATION FOUND: "${text}" -> "${preloadedTranslation}"`);
          return preloadedTranslation;
        }
      }

      // ENHANCED: Graceful fallback to original text
      console.log(`[FlickerFreeTranslatableText3D] USING ORIGINAL: "${text}" (no translation available in ${currentLanguage})`);
      return text;
    } catch (error) {
      console.error(`[FlickerFreeTranslatableText3D] Error in translation lookup:`, error);
      return text; // Always fallback to original text
    }
  }, [text, currentLanguage, sourceLanguage, userId, timeRange]);

  // ENHANCED: Stable text update with validation
  const updateFinalText = useCallback((newText: string) => {
    // Validate the new text before updating
    if (!isValidDisplayText(newText)) {
      console.warn(`[FlickerFreeTranslatableText3D] Invalid final text, using original: "${newText}"`);
      newText = text; // Fallback to original
    }

    if (newText !== finalText) {
      console.log(`[FlickerFreeTranslatableText3D] TEXT UPDATE: "${finalText}" -> "${newText}"`);
      setIsStable(false);
      
      // Very short delay to ensure smooth transitions
      const timer = setTimeout(() => {
        setFinalText(newText);
        setIsStable(true);
        setTranslationAttempted(true);
        if (onTranslationComplete) {
          onTranslationComplete(newText);
        }
      }, 25);

      return () => clearTimeout(timer);
    } else if (!isStable) {
      // Text is the same but we're not stable yet
      setIsStable(true);
      setTranslationAttempted(true);
    }
  }, [finalText, isStable, onTranslationComplete, text]);

  // Update final text when translation changes
  useEffect(() => {
    const cleanup = updateFinalText(translatedText);
    return cleanup;
  }, [translatedText, updateFinalText]);

  // ENHANCED: Always show valid text - no hiding for missing translations
  if (!visible || !isValidDisplayText(text)) {
    return null;
  }

  // Show original text immediately if we haven't attempted translation yet
  const displayText = isStable ? finalText : text;

  console.log(`[FlickerFreeTranslatableText3D] RENDERING: "${displayText}" (stable: ${isStable}, attempted: ${translationAttempted}, valid: ${isValidDisplayText(displayText)})`);

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

export default FlickerFreeTranslatableText3D;
