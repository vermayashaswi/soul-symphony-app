
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCache';
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
  // OPTIMIZED: Enhanced coordinated translation props
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
  const { currentLanguage, getCachedTranslation, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationAttempted, setTranslationAttempted] = useState(false);

  useEffect(() => {
    const translateText = async () => {
      // OPTIMIZED: Prioritize atomic coordinated translation for consistency
      if (useCoordinatedTranslation && coordinatedTranslation && isAtomicMode) {
        console.log(`[TranslatableText3D] OPTIMIZED ATOMIC: Using coordinated translation for "${text}": "${coordinatedTranslation}"`);
        setTranslatedText(coordinatedTranslation);
        onTranslationComplete?.(coordinatedTranslation);
        setTranslationAttempted(true);
        return;
      }

      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
        return;
      }

      // OPTIMIZED: Check node translation cache first
      if (isAtomicMode && currentLanguage !== 'en') {
        const cachedNodeTranslation = await NodeTranslationCacheService.getCachedNodeTranslation(text, currentLanguage);
        if (cachedNodeTranslation) {
          console.log(`[TranslatableText3D] OPTIMIZED ATOMIC: Using node cache for "${text}": "${cachedNodeTranslation}"`);
          setTranslatedText(cachedNodeTranslation);
          onTranslationComplete?.(cachedNodeTranslation);
          setTranslationAttempted(true);
          return;
        }
      }

      // OPTIMIZED: Fallback handling with strict consistency
      if (useCoordinatedTranslation && !coordinatedTranslation && isAtomicMode) {
        console.log(`[TranslatableText3D] OPTIMIZED ATOMIC: No coordinated translation available for "${text}", maintaining consistency`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
        return;
      }

      // OPTIMIZED: Standard translation flow only for non-atomic usage
      if (!useCoordinatedTranslation && !isAtomicMode) {
        const cachedTranslation = getCachedTranslation(text);
        if (cachedTranslation) {
          console.log(`[TranslatableText3D] OPTIMIZED STANDARD: Using app-level cached translation for "${text}": "${cachedTranslation}"`);
          setTranslatedText(cachedTranslation);
          onTranslationComplete?.(cachedTranslation);
          setTranslationAttempted(true);
          return;
        }

        // Skip translation if already attempted and failed
        if (translationAttempted) {
          console.log(`[TranslatableText3D] OPTIMIZED STANDARD: Translation already attempted for "${text}", using original to avoid loops`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
          return;
        }

        if (!translate) {
          console.log(`[TranslatableText3D] OPTIMIZED STANDARD: No translation function available, using original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
          setTranslationAttempted(true);
          return;
        }

        console.log(`[TranslatableText3D] OPTIMIZED STANDARD: No cache found, translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
        
        try {
          setIsTranslating(true);
          const result = await translate(text, sourceLanguage);
          
          if (result && result !== text) {
            console.log(`[TranslatableText3D] OPTIMIZED STANDARD: Translation successful: "${text}" -> "${result}"`);
            // Cache in node translation cache for future use
            await NodeTranslationCacheService.setCachedNodeTranslation(text, result, currentLanguage);
            setTranslatedText(result);
            onTranslationComplete?.(result);
          } else {
            console.log(`[TranslatableText3D] OPTIMIZED STANDARD: Using original text for "${text}" (same as result or null)`);
            setTranslatedText(text);
            onTranslationComplete?.(text);
          }
        } catch (error) {
          console.error(`[TranslatableText3D] OPTIMIZED STANDARD: Translation failed for "${text}":`, error);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        } finally {
          setIsTranslating(false);
          setTranslationAttempted(true);
        }
      } else {
        // OPTIMIZED: In atomic mode, always use original text to maintain consistency
        console.log(`[TranslatableText3D] OPTIMIZED ATOMIC: Maintaining original text for "${text}" in atomic mode`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete, translationAttempted, coordinatedTranslation, useCoordinatedTranslation, isAtomicMode]);

  // OPTIMIZED: Always render with current text - maintain atomic consistency
  return (
    <SmartTextRenderer
      text={translatedText}
      position={position}
      color={isTranslating ? '#888888' : color} // Slightly dim while translating
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
