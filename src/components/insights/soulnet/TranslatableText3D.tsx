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
  // ENHANCED APP-LEVEL: Coordinated translation props
  coordinatedTranslation?: string;
  useCoordinatedTranslation?: boolean;
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
  useCoordinatedTranslation = false
}) => {
  const { currentLanguage, getCachedTranslation, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationAttempted, setTranslationAttempted] = useState(false);

  useEffect(() => {
    const translateText = async () => {
      // ENHANCED APP-LEVEL: Prioritize coordinated translation for atomic consistency
      if (useCoordinatedTranslation && coordinatedTranslation) {
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL ATOMIC: Using coordinated translation for "${text}": "${coordinatedTranslation}"`);
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

      // ENHANCED: Better fallback handling for coordinated translations with debugging
      if (useCoordinatedTranslation && !coordinatedTranslation) {
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL FALLBACK: No coordinated translation available for "${text}", checking app-level cache with improved error handling`);
        
        // Try app-level cache as fallback
        const appLevelCached = getCachedTranslation(text);
        if (appLevelCached) {
          console.log(`[TranslatableText3D] ENHANCED APP-LEVEL FALLBACK: Using app-level cached translation for "${text}": "${appLevelCached}"`);
          setTranslatedText(appLevelCached);
          onTranslationComplete?.(appLevelCached);
          setTranslationAttempted(true);
          return;
        }
        
        // If no cache available, keep original text to avoid partial states
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL FALLBACK: No cache available, using original text for "${text}" to maintain consistency`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
        return;
      }

      // ENHANCED APP-LEVEL: Standard translation flow for non-coordinated usage
      if (!useCoordinatedTranslation) {
        const cachedTranslation = getCachedTranslation(text);
        if (cachedTranslation) {
          console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Using app-level cached translation for "${text}": "${cachedTranslation}"`);
          setTranslatedText(cachedTranslation);
          onTranslationComplete?.(cachedTranslation);
          setTranslationAttempted(true);
          return;
        }

        // Skip translation if already attempted and failed
        if (translationAttempted) {
          console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Translation already attempted for "${text}", using original to avoid loops`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
          return;
        }

        if (!translate) {
          console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: No translation function available, using original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
          setTranslationAttempted(true);
          return;
        }

        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: No cache found, translating "${text}" from ${sourceLanguage} to ${currentLanguage} with enhanced error handling`);
        
        try {
          setIsTranslating(true);
          const result = await translate(text, sourceLanguage);
          
          if (result && result !== text) {
            console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Translation successful: "${text}" -> "${result}"`);
            setTranslatedText(result);
            onTranslationComplete?.(result);
          } else {
            console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Using original text for "${text}" (same as result or null)`);
            setTranslatedText(text);
            onTranslationComplete?.(text);
          }
        } catch (error) {
          console.error(`[TranslatableText3D] ENHANCED APP-LEVEL: Translation failed for "${text}":`, error);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        } finally {
          setIsTranslating(false);
          setTranslationAttempted(true);
        }
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete, translationAttempted, coordinatedTranslation, useCoordinatedTranslation]);

  // Always render with current text - don't hide during translation
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
