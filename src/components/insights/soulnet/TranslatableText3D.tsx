
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
  // NEW: Coordinated translation props
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
      // COORDINATED TRANSLATION: Use coordinated translation if available
      if (useCoordinatedTranslation && coordinatedTranslation) {
        console.log(`[TranslatableText3D] COORDINATED: Using coordinated translation for "${text}": "${coordinatedTranslation}"`);
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

      // PRIORITY 1: Check for pre-cached translation first (from SoulNet preload)
      const cachedTranslation = getCachedTranslation(text);
      if (cachedTranslation) {
        console.log(`[TranslatableText3D] COORDINATED: Using pre-cached translation for "${text}": "${cachedTranslation}"`);
        setTranslatedText(cachedTranslation);
        onTranslationComplete?.(cachedTranslation);
        setTranslationAttempted(true);
        return;
      }

      // Skip translation if already attempted and failed
      if (translationAttempted) {
        console.log(`[TranslatableText3D] COORDINATED: Translation already attempted for "${text}", using original`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      if (!translate) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
        return;
      }

      console.log(`[TranslatableText3D] COORDINATED: No cache or coordination found, translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        const result = await translate(text, sourceLanguage);
        
        if (result && result !== text) {
          console.log(`[TranslatableText3D] COORDINATED: Translation successful: "${text}" -> "${result}"`);
          setTranslatedText(result);
          onTranslationComplete?.(result);
        } else {
          console.log(`[TranslatableText3D] COORDINATED: Using original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        }
      } catch (error) {
        console.error(`[TranslatableText3D] COORDINATED: Translation failed for "${text}":`, error);
        setTranslatedText(text);
        onTranslationComplete?.(text);
      } finally {
        setIsTranslating(false);
        setTranslationAttempted(true);
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
