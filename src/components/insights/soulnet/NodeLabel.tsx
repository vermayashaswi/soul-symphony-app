
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';

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
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  shouldShowLabel,
  cameraZoom,
  themeHex
}) => {
  const { theme } = useTheme();
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(id);
  const [isTranslating, setIsTranslating] = useState(false);
  const prevLangRef = useRef<string>(currentLanguage);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Simplified visibility - always show labels when shouldShowLabel is true
  const isVisible = shouldShowLabel && !!id;
  
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
        
        console.log(`Translated node label "${id}" to "${result}"`);
      } catch (error) {
        console.error(`Failed to translate node label "${id}":`, error);
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
    
    // Increased base size for better visibility
    const baseSize = (0.35 + Math.max(0, (26 - z) * 0.012)) * 0.9;
    
    // Adjust size for non-Latin scripts
    const sizeAdjustment = isDevanagari.current ? 0.08 : 
                          isNonLatin.current ? 0.04 : 0;
    
    // Ensure minimum readable size
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.6), 0.25);
  }, [cameraZoom]);

  // Don't render if not visible or no text
  if (!isVisible || !formattedText) {
    console.log(`NodeLabel not rendering: visible=${isVisible}, text="${formattedText}", id="${id}"`);
    return null;
  }

  // Simplified vertical positioning - closer to nodes for better visibility
  const verticalPosition = type === 'entity' ? 1.8 : 1.8;
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  // Determine text color based on theme and type
  const textColor = type === 'entity' 
    ? (theme === 'light' ? '#000000' : '#ffffff')
    : themeHex;

  console.log(`Rendering NodeLabel for "${id}" (${type}) at position:`, labelPosition, 'with text:', formattedText);

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={true} // Always visible when component renders
      skipTranslation={true} // We handle translation here
      outlineWidth={0.008} // Stronger outline for better visibility
      outlineColor="#000000"
      renderOrder={10} // High render order to ensure text appears on top
    />
  );
};

export default NodeLabel;
