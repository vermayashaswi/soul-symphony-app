
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { nodeTranslationCache } from '@/services/nodeTranslationCache';
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
  // ENHANCED: Context-aware props for smart caching
  userId?: string;
  timeRange?: string;
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
  userId,
  timeRange,
  coordinatedTranslation,
  useCoordinatedTranslation = false
}) => {
  const { currentLanguage, getCachedTranslation, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateText = async () => {
      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        return;
      }

      // ENHANCED: Priority 1 - Centralized node translation cache
      if (userId && timeRange) {
        const centralizedTranslation = nodeTranslationCache.getNodeTranslation(
          userId,
          timeRange,
          currentLanguage,
          text
        );
        if (centralizedTranslation) {
          console.log(`[TranslatableText3D] CENTRALIZED CACHE HIT for "${text}": "${centralizedTranslation}"`);
          setTranslatedText(centralizedTranslation);
          onTranslationComplete?.(centralizedTranslation);
          return;
        }
      }

      // ENHANCED: Priority 2 - Coordinated translation for atomic consistency
      if (useCoordinatedTranslation && coordinatedTranslation) {
        console.log(`[TranslatableText3D] COORDINATED TRANSLATION for "${text}": "${coordinatedTranslation}"`);
        setTranslatedText(coordinatedTranslation);
        onTranslationComplete?.(coordinatedTranslation);
        
        // Store in centralized cache for future use
        if (userId && timeRange) {
          nodeTranslationCache.setNodeTranslation(
            userId,
            timeRange,
            currentLanguage,
            text,
            coordinatedTranslation,
            'coordinated'
          );
        }
        return;
      }

      // ENHANCED: Priority 3 - App-level cache with centralized storage
      if (!useCoordinatedTranslation) {
        const appLevelCached = getCachedTranslation(text);
        if (appLevelCached) {
          console.log(`[TranslatableText3D] APP-LEVEL CACHE HIT for "${text}": "${appLevelCached}"`);
          setTranslatedText(appLevelCached);
          onTranslationComplete?.(appLevelCached);
          
          // Store in centralized cache for future use
          if (userId && timeRange) {
            nodeTranslationCache.setNodeTranslation(
              userId,
              timeRange,
              currentLanguage,
              text,
              appLevelCached,
              'app-level'
            );
          }
          return;
        }

        // Priority 4: Direct translation as last resort
        if (translate) {
          console.log(`[TranslatableText3D] DIRECT TRANSLATION for "${text}"`);
          
          try {
            setIsTranslating(true);
            const result = await translate(text, sourceLanguage);
            
            if (result && result !== text) {
              console.log(`[TranslatableText3D] DIRECT TRANSLATION SUCCESS: "${text}" -> "${result}"`);
              setTranslatedText(result);
              onTranslationComplete?.(result);
              
              // Store in centralized cache
              if (userId && timeRange) {
                nodeTranslationCache.setNodeTranslation(
                  userId,
                  timeRange,
                  currentLanguage,
                  text,
                  result,
                  'direct'
                );
              }
            } else {
              console.log(`[TranslatableText3D] USING ORIGINAL TEXT for "${text}"`);
              setTranslatedText(text);
              onTranslationComplete?.(text);
            }
          } catch (error) {
            console.error(`[TranslatableText3D] TRANSLATION FAILED for "${text}":`, error);
            setTranslatedText(text);
            onTranslationComplete?.(text);
          } finally {
            setIsTranslating(false);
          }
        } else {
          setTranslatedText(text);
          onTranslationComplete?.(text);
        }
      } else {
        // Coordinated mode but no translation available - use original
        setTranslatedText(text);
        onTranslationComplete?.(text);
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete, coordinatedTranslation, useCoordinatedTranslation, userId, timeRange]);

  // Always render with current text
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
