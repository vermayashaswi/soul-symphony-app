
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';

// Helper function to detect non-Latin script
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  const patterns = {
    devanagari: /[\u0900-\u097F]/,
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/,
    cyrillic: /[\u0400-\u04FF]/
  };
  
  return Object.values(patterns).some(pattern => pattern.test(text));
};

const containsDevanagari = (text: string): boolean => {
  if (!text) return false;
  const devanagariPattern = /[\u0900-\u097F]/;
  return devanagariPattern.test(text);
};

// Format entity node text to display on two lines
const formatEntityText = (text: string): string => {
  if (!text || text.length <= 6) return text;
  
  const words = text.split(' ');
  if (words.length === 1) return text;
  
  const midPoint = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, midPoint).join(' ');
  const secondLine = words.slice(midPoint).join(' ');
  
  return firstLine + '\n' + secondLine;
};

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  shouldShowLabel: boolean;
  isTutorialMode: boolean;
  themeHex: string;
  isHighlighted: boolean;
  cameraZoom?: number;
  isFullScreen?: boolean;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  shouldShowLabel,
  isTutorialMode,
  themeHex,
  isHighlighted,
  cameraZoom = 52,
  isFullScreen = false
}) => {
  const { theme } = useTheme();
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(id);
  const [isTranslating, setIsTranslating] = useState(false);
  const prevLangRef = useRef<string>(currentLanguage);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Handle translation when the label should be displayed
  useEffect(() => {
    if (!shouldShowLabel || currentLanguage === 'en' || !id) {
      return;
    }
    
    const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
    
    if (cachedTranslation) {
      setTranslatedText(cachedTranslation);
      isNonLatin.current = containsNonLatinScript(cachedTranslation);
      isDevanagari.current = containsDevanagari(cachedTranslation);
      return;
    }
    
    const translateText = async () => {
      try {
        setIsTranslating(true);
        const result = await translate(id);
        setTranslatedText(result);
        
        onDemandTranslationCache.setTranslation(id, result, currentLanguage);
        
        isNonLatin.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
      } catch (error) {
        console.error(`[NodeLabel] Failed to translate "${id}":`, error);
      } finally {
        setIsTranslating(false);
      }
    };
    
    translateText();
  }, [id, shouldShowLabel, currentLanguage, translate]);
  
  // Clear translations when language changes
  useEffect(() => {
    if (prevLangRef.current !== currentLanguage) {
      setTranslatedText(id);
      prevLangRef.current = currentLanguage;
    }
  }, [currentLanguage, id]);
  
  // Format text for display
  const formattedText = useMemo(() => {
    if (type === 'entity') {
      const textToFormat = translatedText || id;
      return formatEntityText(textToFormat);
    }
    return translatedText || id;
  }, [id, type, translatedText]);

  // Original font size calculation based on camera zoom and node type
  const fontSize = useMemo(() => {
    const baseSize = type === 'entity' ? 0.35 : 0.3;
    const zoomFactor = Math.max(0.8, Math.min(1.2, 52 / cameraZoom));
    const tutorialBoost = isTutorialMode ? 1.2 : 1.0;
    const highlightBoost = isHighlighted ? 1.1 : 1.0;
    const fullscreenBoost = isFullScreen ? 1.1 : 1.0;
    
    let size = baseSize * zoomFactor * tutorialBoost * highlightBoost * fullscreenBoost;
    
    // Adjust for non-Latin scripts
    if (isDevanagari.current) {
      size += 0.05;
    } else if (isNonLatin.current) {
      size += 0.03;
    }
    
    return Math.max(Math.min(size, 0.6), 0.25);
  }, [type, cameraZoom, isTutorialMode, isHighlighted, isFullScreen]);

  // Original text color calculation
  const textColor = useMemo(() => {
    if (type === 'entity') {
      return theme === 'light' ? '#1a1a1a' : '#ffffff';
    } else {
      return themeHex;
    }
  }, [type, theme, themeHex]);
  
  const outlineColor = theme === 'light' ? '#ffffff' : '#000000';

  // Original position calculation with proper offset
  const verticalOffset = type === 'entity' ? 1.8 : 1.6;
  const finalPosition: [number, number, number] = [
    position[0], 
    position[1] + verticalOffset, 
    position[2]
  ];

  // Original render order calculation
  const renderOrder = isTutorialMode ? 25 : (isHighlighted ? 20 : 15);
  
  // Original outline width calculation
  const outlineWidth = isTutorialMode ? 0.015 : (isHighlighted ? 0.01 : 0.008);

  // Don't render if not visible or no text
  if (!shouldShowLabel || !formattedText) {
    return null;
  }

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={finalPosition}
      color={textColor}
      size={fontSize}
      bold={isHighlighted || isTutorialMode}
      visible={true}
      skipTranslation={true}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      renderOrder={renderOrder}
    />
  );
};

export default NodeLabel;
