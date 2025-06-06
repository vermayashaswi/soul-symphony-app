
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

// ENHANCED: Comprehensive text validation utilities
function isValidDisplayText(text: string): boolean {
  if (typeof text !== 'string') {
    console.warn(`[FlickerFreeTranslatableText3D] Non-string text:`, typeof text, text);
    return false;
  }
  
  const trimmed = text.trim();
  
  // Check for empty or whitespace-only strings
  if (trimmed.length === 0) {
    console.warn(`[FlickerFreeTranslatableText3D] Empty text after trim:`, text);
    return false;
  }
  
  // Check for invalid placeholder values
  const invalidValues = ['undefined', 'null', 'NaN', '[object Object]', 'true', 'false'];
  if (invalidValues.includes(trimmed.toLowerCase())) {
    console.warn(`[FlickerFreeTranslatableText3D] Invalid text value:`, trimmed);
    return false;
  }
  
  return true;
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
  const [fallbackMode, setFallbackMode] = useState<boolean>(false);

  // ENHANCED: Comprehensive text validation and translation lookup with fallback handling
  const translatedText = useMemo(() => {
    try {
      // ENHANCED: Validate input text with detailed logging
      if (!isValidDisplayText(text)) {
        console.warn(`[FlickerFreeTranslatableText3D] Invalid text provided: "${text}", entering fallback mode`);
        setFallbackMode(true);
        return text; // Return as-is for invalid texts
      }

      // If same language, return original text immediately
      if (currentLanguage === sourceLanguage) {
        console.log(`[FlickerFreeTranslatableText3D] Same language (${currentLanguage}), using original: "${text}"`);
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
          setFallbackMode(false);
          return preloadedTranslation;
        } else {
          console.log(`[FlickerFreeTranslatableText3D] No valid preloaded translation for "${text}" in ${currentLanguage}`);
        }
      }

      // ENHANCED: Graceful fallback to original text with logging
      console.log(`[FlickerFreeTranslatableText3D] USING ORIGINAL: "${text}" (no translation available in ${currentLanguage})`);
      setFallbackMode(true);
      return text;
    } catch (error) {
      console.error(`[FlickerFreeTranslatableText3D] Error in translation lookup:`, error);
      setFallbackMode(true);
      return text; // Always fallback to original text
    }
  }, [text, currentLanguage, sourceLanguage, userId, timeRange]);

  // ENHANCED: Stable text update with validation and fallback handling
  const updateFinalText = useCallback((newText: string) => {
    // Validate the new text before updating
    if (!isValidDisplayText(newText)) {
      console.warn(`[FlickerFreeTranslatableText3D] Invalid final text, using original: "${newText}"`);
      newText = text; // Fallback to original
      setFallbackMode(true);
    }

    if (newText !== finalText) {
      console.log(`[FlickerFreeTranslatableText3D] TEXT UPDATE: "${finalText}" -> "${newText}" (fallback: ${fallbackMode})`);
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
  }, [finalText, isStable, onTranslationComplete, text, fallbackMode]);

  // Update final text when translation changes
  useEffect(() => {
    const cleanup = updateFinalText(translatedText);
    return cleanup;
  }, [translatedText, updateFinalText]);

  // ENHANCED: Always show valid text - no hiding for missing translations
  if (!visible || !isValidDisplayText(text)) {
    return null;
  }

  // Show original text immediately if we haven't attempted translation yet, or if in fallback mode
  const displayText = isStable ? finalText : text;

  console.log(`[FlickerFreeTranslatableText3D] RENDERING: "${displayText}" (stable: ${isStable}, attempted: ${translationAttempted}, fallback: ${fallbackMode}, valid: ${isValidDisplayText(displayText)})`);

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
