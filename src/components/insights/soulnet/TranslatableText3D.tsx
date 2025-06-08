
import React, { useState, useEffect, useRef } from 'react';
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
  // NEW: Force translation method
  forceTranslate?: boolean;
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
  forceTranslate = false
}) => {
  const { currentLanguage, getCachedTranslation, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCompleted, setTranslationCompleted] = useState(false);
  
  // Refs to track stable values
  const currentLangRef = useRef<string>(currentLanguage);
  const textRef = useRef<string>(text);
  const forceTranslateRef = useRef<boolean>(forceTranslate);

  // Reset translation completion when text or language changes
  useEffect(() => {
    if (textRef.current !== text || currentLangRef.current !== currentLanguage || forceTranslateRef.current !== forceTranslate) {
      setTranslationCompleted(false);
      textRef.current = text;
      currentLangRef.current = currentLanguage;
      forceTranslateRef.current = forceTranslate;
    }
  }, [text, currentLanguage, forceTranslate]);

  useEffect(() => {
    const translateText = async () => {
      // Skip if translation is already completed and not forced
      if (translationCompleted && !forceTranslate) {
        console.log(`[TranslatableText3D] Translation already completed for "${text}", skipping`);
        return;
      }

      // ENHANCED APP-LEVEL: Prioritize coordinated translation for atomic consistency
      if (useCoordinatedTranslation && coordinatedTranslation) {
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL ATOMIC: Using coordinated translation for "${text}": "${coordinatedTranslation}"`);
        setTranslatedText(coordinatedTranslation);
        onTranslationComplete?.(coordinatedTranslation);
        setTranslationCompleted(true);
        return;
      }

      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationCompleted(true);
        return;
      }

      // Check app-level cache first
      const appLevelCached = getCachedTranslation(text);
      if (appLevelCached) {
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Using app-level cached translation for "${text}": "${appLevelCached}"`);
        setTranslatedText(appLevelCached);
        onTranslationComplete?.(appLevelCached);
        setTranslationCompleted(true);
        return;
      }

      // Only proceed with translation if not using coordinated translation
      if (!useCoordinatedTranslation && translate) {
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Starting translation for "${text}" from ${sourceLanguage} to ${currentLanguage}`);
        
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
          setTranslationCompleted(true);
        } catch (error) {
          console.error(`[TranslatableText3D] ENHANCED APP-LEVEL: Translation failed for "${text}":`, error);
          setTranslatedText(text);
          onTranslationComplete?.(text);
          setTranslationCompleted(true);
        } finally {
          setIsTranslating(false);
        }
      } else {
        // For coordinated translation without coordination data, use original text
        console.log(`[TranslatableText3D] ENHANCED APP-LEVEL: Using original text for coordinated translation without data: "${text}"`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationCompleted(true);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete, coordinatedTranslation, useCoordinatedTranslation, forceTranslate, translationCompleted]);

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
