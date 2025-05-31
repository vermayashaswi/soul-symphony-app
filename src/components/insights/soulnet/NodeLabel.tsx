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

// Format entity node text to display on two lines
const formatEntityText = (text: string): string => {
  if (!text || text.length <= 3) return text;
  
  // Split text in approximately half to create two lines
  const halfLength = Math.ceil(text.length / 2);
  let splitIndex = halfLength;
  
  // Look for natural break points like spaces near the middle
  const spaceIndices = [...text.matchAll(/\s/g)].map(match => match.index as number);
  if (spaceIndices.length > 0) {
    // Find the space closest to the middle
    const nearestSpace = spaceIndices.reduce((closest, current) => {
      return Math.abs(current - halfLength) < Math.abs(closest - halfLength) ? current : closest;
    }, spaceIndices[0]);
    
    splitIndex = nearestSpace;
  }
  
  // Create two-line text with line break
  return text.substring(0, splitIndex) + '\n' + text.substring(splitIndex).trim();
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

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Reduced base size from 0.5 to 0.12 and adjusted zoom scaling
    const baseSize = (0.12 + Math.max(0, (26 - z) * 0.004)) * (isTutorialStep9 ? 1.2 : 1.0);
    
    // Adjust size for non-Latin scripts
    const sizeAdjustment = isDevanagari.current ? 0.02 : 
                          isNonLatin.current ? 0.015 : 0;
    
    // Reduced minimum size for better proportion
    const minSize = isTutorialStep9 ? 0.1 : 0.08;
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.2), minSize);
  }, [cameraZoom, isTutorialStep9]);

  // Don't render if not visible or no text
  if (!isVisible || !formattedText) {
    if (isTutorialStep9) {
      console.log(`[NodeLabel] Tutorial Step 9 - Not rendering ${id}: visible=${isVisible}, text="${formattedText}"`);
    }
    return null;
  }

  // Significantly reduced vertical offset for better positioning
  const verticalOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 0.8 : 0.7; // Reduced from 2.2/2.0 to 0.8/0.7
    // Reduced extra offset for tutorial mode
    return isTutorialStep9 ? baseOffset + 0.1 : baseOffset;
  }, [type, isTutorialStep9]);

  // Enhanced text color logic with better contrast for tutorial
  const textColor = useMemo(() => {
    if (isTutorialStep9) {
      // Force high contrast colors in tutorial mode
      return type === 'entity' 
        ? (theme === 'light' ? '#000000' : '#ffffff')
        : themeHex;
    }
    return type === 'entity' 
      ? (theme === 'light' ? '#1a1a1a' : '#ffffff')
      : themeHex;
  }, [type, theme, themeHex, isTutorialStep9]);

  // Enhanced outline for better visibility, especially in tutorial
  const outlineWidth = useMemo(() => {
    if (isTutorialStep9) return 0.008; // Reduced from 0.015
    return isHighlighted ? 0.006 : 0.004; // Reduced from 0.012/0.008
  }, [isHighlighted, isTutorialStep9]);
  
  const outlineColor = theme === 'light' ? '#ffffff' : '#000000';

  // Calculate final position with proper offset
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
      bold={isHighlighted || isTutorialStep9}
      visible={true}
      skipTranslation={true}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      renderOrder={isTutorialStep9 ? 20 : 15} // Higher render order in tutorial mode
    />
  );
};

export default NodeLabel;
