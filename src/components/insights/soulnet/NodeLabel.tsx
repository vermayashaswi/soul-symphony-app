
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
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Check if text contains non-Latin script and memoize the result
  useEffect(() => {
    if (translatedText) {
      isNonLatin.current = containsNonLatinScript(translatedText);
      isDevanagari.current = containsDevanagari(translatedText);
    }
  }, [translatedText]);

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation 
    const baseSize = 0.26 + Math.max(0, (26 - z) * 0.0088);
    
    // Adjust size for non-Latin scripts - they often need slightly bigger font
    // Reduced size adjustment for better consistency
    const sizeAdjustment = isDevanagari.current ? 0.04 : 
                          isNonLatin.current ? 0.02 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.5), 0.23);
  }, [cameraZoom, isNonLatin.current, isDevanagari.current]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  // Adjust vertical positioning for different script types - made more consistent
  let verticalPosition = type === 'entity' ? 0.9 : 0.8;
  
  // More subtle adjustments for different script types
  if (isDevanagari.current) {
    verticalPosition += 0.08;
  } else if (isNonLatin.current) {
    verticalPosition += 0.04;
  }
  
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  return (
    <ThreeDimensionalText
      text={translatedText || id}
      position={labelPosition}
      color={type === 'entity' ? '#ffffff' : themeHex}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={true}
    />
  );
};

export default NodeLabel;
