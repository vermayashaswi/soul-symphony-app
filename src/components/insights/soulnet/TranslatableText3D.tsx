
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import SmartTextRenderer from './SmartTextRenderer';
import { useSoulNetTranslation } from './SoulNetTranslationTracker';

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
  nodeId?: string; // For tracking purposes
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
  nodeId
}) => {
  const { currentLanguage, getCachedTranslation, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationAttempted, setTranslationAttempted] = useState(false);
  
  // Get translation tracker if available
  const translationTracker = React.useContext(React.createContext<any>(undefined));
  const soulNetTranslation = React.useMemo(() => {
    try {
      return require('./SoulNetTranslationTracker').useSoulNetTranslation?.();
    } catch {
      return null;
    }
  }, []);

  // Register with tracker when nodeId is provided
  useEffect(() => {
    if (nodeId && soulNetTranslation) {
      soulNetTranslation.registerNode(nodeId);
    }
  }, [nodeId, soulNetTranslation]);

  useEffect(() => {
    const translateText = async () => {
      if (!text || currentLanguage === sourceLanguage) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
        
        // Mark as translated for tracker
        if (nodeId && soulNetTranslation) {
          soulNetTranslation.markNodeTranslated(nodeId);
        }
        return;
      }

      // PRIORITY 1: Check for pre-cached translation first (from SoulNet preload)
      const cachedTranslation = getCachedTranslation(text);
      if (cachedTranslation) {
        console.log(`[TranslatableText3D] Using pre-cached translation for "${text}": "${cachedTranslation}"`);
        setTranslatedText(cachedTranslation);
        onTranslationComplete?.(cachedTranslation);
        setTranslationAttempted(true);
        
        // Mark as translated for tracker
        if (nodeId && soulNetTranslation) {
          soulNetTranslation.markNodeTranslated(nodeId);
        }
        return;
      }

      // Skip translation if already attempted and failed
      if (translationAttempted) {
        console.log(`[TranslatableText3D] Translation already attempted for "${text}", using original`);
        setTranslatedText(text);
        onTranslationComplete?.(text);
        
        // Mark as translated for tracker
        if (nodeId && soulNetTranslation) {
          soulNetTranslation.markNodeTranslated(nodeId);
        }
        return;
      }

      if (!translate) {
        setTranslatedText(text);
        onTranslationComplete?.(text);
        setTranslationAttempted(true);
        
        // Mark as translated for tracker
        if (nodeId && soulNetTranslation) {
          soulNetTranslation.markNodeTranslated(nodeId);
        }
        return;
      }

      console.log(`[TranslatableText3D] No cache found, translating "${text}" from ${sourceLanguage} to ${currentLanguage}`);
      
      try {
        setIsTranslating(true);
        const result = await translate(text, sourceLanguage);
        
        if (result && result !== text) {
          console.log(`[TranslatableText3D] Translation successful: "${text}" -> "${result}"`);
          setTranslatedText(result);
          onTranslationComplete?.(result);
        } else {
          console.log(`[TranslatableText3D] Using original text for "${text}"`);
          setTranslatedText(text);
          onTranslationComplete?.(text);
        }
      } catch (error) {
        console.error(`[TranslatableText3D] Translation failed for "${text}":`, error);
        setTranslatedText(text);
        onTranslationComplete?.(text);
      } finally {
        setIsTranslating(false);
        setTranslationAttempted(true);
        
        // Mark as translated for tracker
        if (nodeId && soulNetTranslation) {
          soulNetTranslation.markNodeTranslated(nodeId);
        }
      }
    };

    translateText();
  }, [text, currentLanguage, sourceLanguage, translate, getCachedTranslation, onTranslationComplete, translationAttempted, nodeId, soulNetTranslation]);

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
