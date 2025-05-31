import React, { useMemo, useRef, useEffect, useState } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { useTutorial } from '@/contexts/TutorialContext';

// Helper function to detect non-Latin script
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  // Regex patterns for different script ranges
  const patterns = {
    devanagari: /[\u0900-\u097F]/,  // Hindi, Sanskrit, etc.
    arabic: /[\u0600-\u06FF]/,      // Arabic
    chinese: /[\u4E00-\u9FFF]/,     // Chinese
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,  // Japanese Hiragana and Katakana
    korean: /[\uAC00-\uD7AF]/,      // Korean Hangul
    cyrillic: /[\u0400-\u04FF]/     // Russian and other Cyrillic
  };
  
  // Check if text contains any non-Latin script
  return Object.values(patterns).some(pattern => pattern.test(text));
};

// Specifically detect Devanagari script (Hindi)
const containsDevanagari = (text: string): boolean => {
  if (!text) return false;
  const devanagariPattern = /[\u0900-\u097F]/;
  return devanagariPattern.test(text);
};

// Improved entity text formatting for better visual balance
const formatEntityText = (text: string): string => {
  if (!text || text.length <= 4) return text;
  
  // For longer entity names, create balanced two-line display
  const words = text.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word - split at natural break point
    const word = words[0];
    if (word.length <= 8) return word;
    
    const midPoint = Math.ceil(word.length / 2);
    return word.substring(0, midPoint) + '\n' + word.substring(midPoint);
  }
  
  if (words.length === 2) {
    // Two words - keep on separate lines
    return words.join('\n');
  }
  
  // Multiple words - group for balanced lines
  const totalLength = text.length;
  const targetFirstLineLength = Math.ceil(totalLength / 2);
  
  let firstLine = '';
  let wordIndex = 0;
  
  while (wordIndex < words.length && (firstLine + words[wordIndex]).length <= targetFirstLineLength) {
    firstLine += (firstLine ? ' ' : '') + words[wordIndex];
    wordIndex++;
  }
  
  const secondLine = words.slice(wordIndex).join(' ');
  return firstLine + '\n' + secondLine;
};

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  forceVisible?: boolean; // New prop for tutorial mode
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  forceVisible = false
}) => {
  const { theme } = useTheme();
  const { currentLanguage, translate } = useTranslation();
  const { isInStep } = useTutorial();
  const [translatedText, setTranslatedText] = useState<string>(id);
  const [isTranslating, setIsTranslating] = useState(false);
  const prevLangRef = useRef<string>(currentLanguage);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Enhanced visibility logic - prioritize tutorial step 9 and forceVisible
  const isTutorialStep9 = isInStep(9);
  const isVisible = isTutorialStep9 || forceVisible || shouldShowLabel;
  
  // Enhanced debug logging for tutorial step 9
  useEffect(() => {
    if (isTutorialStep9) {
      console.log(`[NodeLabel] Tutorial Step 9 - ${id} (${type}):`, {
        position,
        isVisible,
        shouldShowLabel,
        forceVisible,
        isTutorialStep9,
        isHighlighted,
        cameraZoom
      });
    }
  }, [id, type, position, isVisible, shouldShowLabel, forceVisible, isTutorialStep9, isHighlighted, cameraZoom]);
  
  // Handle translation when the label should be displayed
  useEffect(() => {
    if (!isVisible || currentLanguage === 'en' || !id) {
      return;
    }
    
    // Check cache first
    const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
    
    if (cachedTranslation) {
      setTranslatedText(cachedTranslation);
      isNonLatin.current = containsNonLatinScript(cachedTranslation);
      isDevanagari.current = containsDevanagari(cachedTranslation);
      return;
    }
    
    // Translate without debouncing for immediate display
    const translateText = async () => {
      try {
        setIsTranslating(true);
        const result = await translate(id);
        setTranslatedText(result);
        
        // Cache the result
        onDemandTranslationCache.setTranslation(id, result, currentLanguage);
        
        // Update script detection
        isNonLatin.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
        
        console.log(`[NodeLabel] Translated "${id}" to "${result}"`);
      } catch (error) {
        console.error(`[NodeLabel] Failed to translate "${id}":`, error);
      } finally {
        setIsTranslating(false);
      }
    };
    
    translateText();
  }, [id, isVisible, currentLanguage, translate]);
  
  // Clear translations when language changes
  useEffect(() => {
    if (prevLangRef.current !== currentLanguage) {
      setTranslatedText(id);
      prevLangRef.current = currentLanguage;
    }
  }, [currentLanguage, id]);
  
  // Format entity text for display - always apply for entity type
  const formattedText = useMemo(() => {
    if (type === 'entity') {
      const textToFormat = translatedText || id;
      return formatEntityText(textToFormat);
    }
    return translatedText || id;
  }, [id, type, translatedText]);

  // Reduced font sizing by 75% to match user request
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45; // Updated default from 26 to 45
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    // Reduced base font size by 75% (from 0.8 to 0.2)
    const baseSize = 0.2 + Math.max(0, (45 - z) * 0.005); // Adjusted scaling factor
    
    // Adjust size for non-Latin scripts
    const sizeAdjustment = isDevanagari.current ? 0.04 : 
                          isNonLatin.current ? 0.025 : 0;
    
    // Reduced minimum size proportionally (from 0.6 to 0.15)
    const minSize = 0.15;
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.3), minSize); // Reduced max size from 1.2 to 0.3
  }, [cameraZoom]);

  // Don't render if not visible or no text
  if (!isVisible || !formattedText) {
    if (isTutorialStep9) {
      console.log(`[NodeLabel] Tutorial Step 9 - Not rendering ${id}: visible=${isVisible}, text="${formattedText}"`);
    }
    return null;
  }

  // Significantly reduced vertical offset to bring labels much closer to nodes
  const verticalOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 0.8 : 0.6; // Reduced from 1.6/1.4 to 0.8/0.6
    return baseOffset;
  }, [type]);

  // Text color logic with good contrast
  const textColor = useMemo(() => {
    return type === 'entity' 
      ? (theme === 'light' ? '#1a1a1a' : '#ffffff')
      : themeHex;
  }, [type, theme, themeHex]);

  // Outline for better visibility
  const outlineWidth = useMemo(() => {
    return isHighlighted ? 0.015 : 0.01; // Slightly increased for better definition
  }, [isHighlighted]);
  
  const outlineColor = theme === 'light' ? '#ffffff' : '#000000';

  // Calculate final position with reduced offset
  const finalPosition: [number, number, number] = [
    position[0], 
    position[1] + verticalOffset, 
    position[2]
  ];

  if (isTutorialStep9) {
    console.log(`[NodeLabel] Tutorial Step 9 - Rendering "${id}" (${type}) at position:`, finalPosition, 'with text:', formattedText);
  }

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={finalPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={true}
      skipTranslation={true}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      renderOrder={15}
    />
  );
};

export default NodeLabel;
