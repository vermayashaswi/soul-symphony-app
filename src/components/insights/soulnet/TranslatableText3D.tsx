
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { SoulNetTranslationManager } from '@/services/soulNetTranslationManager';
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
  onTranslationComplete
}) => {
  const { currentLanguage, getCachedTranslation } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasTranslationCompleted, setHasTranslationCompleted] = useState(false);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  useEffect(() => {
    const translateWithRetry = async () => {
      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setHasTranslationCompleted(true);
        return;
      }

      // PRIORITY 1: Check for pre-cached translation (from SoulNet manager)
      const managerTranslation = SoulNetTranslationManager.getCompletedTranslation(text, currentLanguage);
      if (managerTranslation) {
        console.log(`[TranslatableText3D] Using SoulNet manager translation for "${text}": "${managerTranslation}"`);
        setTranslatedText(managerTranslation);
        onTranslationComplete?.(managerTranslation);
        setHasTranslationCompleted(true);
        return;
      }

      // PRIORITY 2: Check for cached translation
      const cachedTranslation = getCachedTranslation(text);
      if (cachedTranslation) {
        console.log(`[TranslatableText3D] Using cached translation for "${text}": "${cachedTranslation}"`);
        setTranslatedText(cachedTranslation);
        onTranslationComplete?.(cachedTranslation);
        setHasTranslationCompleted(true);
        return;
      }

      // ENHANCED: Retry logic for failed translations
      if (retryCount < MAX_RETRIES && !hasTranslationCompleted) {
        console.log(`[TranslatableText3D] Attempting translation for "${text}" (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        try {
          setIsTranslating(true);
          
          // Use SoulNet translation manager for better reliability
          const translations = await SoulNetTranslationManager.translateSoulNetNodes(
            [text],
            currentLanguage
          );
          
          const result = translations.get(text);
          
          if (result && result !== text) {
            console.log(`[TranslatableText3D] Translation successful: "${text}" -> "${result}"`);
            setTranslatedText(result);
            onTranslationComplete?.(result);
            setHasTranslationCompleted(true);
          } else if (retryCount < MAX_RETRIES - 1) {
            console.log(`[TranslatableText3D] Translation attempt ${retryCount + 1} failed, retrying...`);
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, RETRY_DELAY * (retryCount + 1)); // Exponential backoff
          } else {
            console.log(`[TranslatableText3D] All translation attempts failed for "${text}", using original`);
            setTranslatedText(text);
            onTranslationComplete?.(text);
            setHasTranslationCompleted(true);
          }
        } catch (error) {
          console.error(`[TranslatableText3D] Translation error for "${text}":`, error);
          if (retryCount < MAX_RETRIES - 1) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, RETRY_DELAY * (retryCount + 1));
          } else {
            setTranslatedText(text);
            onTranslationComplete?.(text);
            setHasTranslationCompleted(true);
          }
        } finally {
          setIsTranslating(false);
        }
      } else if (!hasTranslationCompleted) {
        // Fallback to original text
        console.log(`[TranslatableText3D] Using original text for "${text}" after max retries`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setHasTranslationCompleted(true);
      }
    };

    translateWithRetry();
  }, [text, currentLanguage, sourceLanguage, getCachedTranslation, onTranslationComplete, retryCount, hasTranslationCompleted]);

  // Reset state when text or language changes
  useEffect(() => {
    setRetryCount(0);
    setHasTranslationCompleted(false);
    setIsTranslating(false);
  }, [text, currentLanguage]);

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
