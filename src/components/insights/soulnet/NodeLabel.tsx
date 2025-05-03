
import React, { useMemo, useRef, useEffect } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';

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

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  translatedText?: string;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  translatedText
}) => {
  console.log(`NodeLabel for "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}, type=${type}, translatedText=${translatedText}`);
  const prevTranslatedText = useRef<string | undefined>(translatedText);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Check if text contains non-Latin script and memoize the result
  useEffect(() => {
    if (translatedText && translatedText !== prevTranslatedText.current) {
      isNonLatin.current = containsNonLatinScript(translatedText);
      isDevanagari.current = containsDevanagari(translatedText);
      prevTranslatedText.current = translatedText;
      
      // Debug logging for Hindi text issues
      if (isDevanagari.current) {
        console.log(`Hindi text detected in node "${id}": "${translatedText}"`);
      }
    }
  }, [translatedText, id]);

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation adjusted by 30%
    const baseSize = 0.26 + Math.max(0, (26 - z) * 0.0088);
    
    // Adjust size for non-Latin scripts - they often need slightly bigger font
    // Devanagari (Hindi) scripts need even larger adjustment
    const sizeAdjustment = isDevanagari.current ? 0.04 : 
                           isNonLatin.current ? 0.02 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.4), 0.23);
  }, [cameraZoom, isNonLatin.current, isDevanagari.current]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  // Keep node labels at a consistent position, lower than percentage labels
  // Use different vertical positions for entity vs emotion nodes
  const verticalPosition = type === 'entity' ? 0.9 : 0.8;
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  return (
    <ThreeDimensionalText
      text={translatedText || id}
      position={labelPosition}
      color={type === 'entity' ? '#ffffff' : themeHex}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={shouldShowLabel}
    />
  );
};

export default NodeLabel;
