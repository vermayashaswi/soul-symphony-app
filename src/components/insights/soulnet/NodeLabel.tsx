
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
  if (!text || text.length <= 3) return text;
  
  const halfLength = Math.ceil(text.length / 2);
  let splitIndex = halfLength;
  
  const spaceIndices = [...text.matchAll(/\s/g)].map(match => match.index as number);
  if (spaceIndices.length > 0) {
    const nearestSpace = spaceIndices.reduce((closest, current) => {
      return Math.abs(current - halfLength) < Math.abs(closest - halfLength) ? current : closest;
    }, spaceIndices[0]);
    
    splitIndex = nearestSpace;
  }
  
  return text.substring(0, splitIndex) + '\n' + text.substring(splitIndex).trim();
};

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  shouldShowLabel: boolean;
  isTutorialMode: boolean;
  dynamicProps: {
    fontSize: number;
    verticalOffset: number;
    renderOrder: number;
    outlineWidth: number;
  };
  themeHex: string;
  isHighlighted: boolean;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  shouldShowLabel,
  isTutorialMode,
  dynamicProps,
  themeHex,
  isHighlighted
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

  // Calculate font size with script adjustments
  const finalFontSize = useMemo(() => {
    let size = dynamicProps.fontSize;
    
    const sizeAdjustment = isDevanagari.current ? 0.1 : 
                          isNonLatin.current ? 0.06 : 0;
    
    const minSize = isTutorialMode ? 0.4 : 0.35;
    return Math.max(Math.min(size + sizeAdjustment, 0.8), minSize);
  }, [dynamicProps.fontSize, isTutorialMode]);

  // Calculate text color with tutorial enhancement
  const textColor = useMemo(() => {
    if (isTutorialMode) {
      return type === 'entity' 
        ? (theme === 'light' ? '#000000' : '#ffffff')
        : themeHex;
    }
    return type === 'entity' 
      ? (theme === 'light' ? '#1a1a1a' : '#ffffff')
      : themeHex;
  }, [type, theme, themeHex, isTutorialMode]);
  
  const outlineColor = theme === 'light' ? '#ffffff' : '#000000';

  // Calculate final position with offset
  const finalPosition: [number, number, number] = [
    position[0], 
    position[1] + dynamicProps.verticalOffset, 
    position[2]
  ];

  // Don't render if not visible or no text
  if (!shouldShowLabel || !formattedText) {
    return null;
  }

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={finalPosition}
      color={textColor}
      size={finalFontSize}
      bold={isHighlighted || isTutorialMode}
      visible={true}
      skipTranslation={true}
      outlineWidth={dynamicProps.outlineWidth}
      outlineColor={outlineColor}
      renderOrder={dynamicProps.renderOrder}
    />
  );
};

export default NodeLabel;
