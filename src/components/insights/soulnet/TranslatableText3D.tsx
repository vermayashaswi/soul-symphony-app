
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { NodeTranslationCacheService } from '@/services/nodeTranslationCacheService';
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
  // ENHANCED: Coordinated translation props
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
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateText = async () => {
      // ENHANCED: Prioritize coordinated translation for atomic consistency
      if (useCoordinatedTranslation && coordinatedTranslation) {
        console.log(`[TranslatableText3D] Using coordinated translation for "${text}": "${coordinatedTranslation}"`);
        setTranslatedText(coordinatedTranslation);
        onTranslationComplete?.(coordinatedTranslation);
        return;
      }

      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      // ENHANCED: Check node-specific cache first
      const cachedTranslation = NodeTranslationCacheService.getCachedTranslation(text, currentLanguage);
      if (cachedTranslation) {
        console.log(`[TranslatableText3D] Using node cache for "${text}": "${cachedTranslation}"`);
        setTranslatedText(cachedTranslation);
        onTranslationComplete?.(cachedTranslation);
        return;
      }

      // ENHANCED: Fallback to coordinated translation system if no cache
      if (useCoordinatedTranslation && !coordinatedTranslation) {
        console.log(`[TranslatableText3D] No coordinated translation available for "${text}", using original`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      // ENHANCED: Only translate if not using coordinated system
      if (!useCoordinatedTranslation && translate) {
        console.log(`[TranslatableText3D] Translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
        
        try {
          setIsTranslating(true);
          const result = await translate(text, sourceLanguage);
          
          if (result && result !== text) {
            console.log(`[TranslatableText3D] Translation successful: "${text}" -> "${result}"`);
            // Cache the result in node-specific cache
            NodeTranslationCacheService.setCachedTranslation(text, result, currentLanguage);
            setTranslatedText(result);
            onTranslationComplete?.(result);
          } else {
            console.log(`[TranslatableText3D] Using original text for "${text}"`);
            NodeTranslationCacheService.setCachedTranslation(text, text, currentLanguage);
            setTranslatedText(text);
            onTranslationComplete?.(text);
          }
        } catch (error) {
          console.error(`[TranslatableText3D] Translation failed for "${text}":`, error);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        } finally {
          setIsTranslating(false);
        }
      } else {
        setTranslatedText(text);
        onTranslationComplete?.(text);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, onTranslationComplete, coordinatedTranslation, useCoordinatedTranslation]);

  // Always render with current text - don't hide during translation
  return (
    <SmartTextRenderer
      text={translatedText}
      position={position}
      color={isTranslating ? '#888888' : color}
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
