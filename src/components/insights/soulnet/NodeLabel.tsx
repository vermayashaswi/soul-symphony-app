
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
  const isVisible = useRef<boolean>(shouldShowLabel);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Detect if the text contains non-Latin characters
  useEffect(() => {
    if (translatedText || id) {
      const textToCheck = translatedText || id;
      isDevanagari.current = containsDevanagari(textToCheck);
      isNonLatin.current = containsNonLatinScript(textToCheck) || isDevanagari.current;
    }
  }, [translatedText, id]);
  
  // Update visibility immediately for all languages
  useEffect(() => {
    isVisible.current = shouldShowLabel;
  }, [shouldShowLabel]);

  // Use fallback when translation is missing
  const displayText = useMemo(() => {
    return translatedText || id;
  }, [translatedText, id]);

  // Calculate dynamic font size based on camera zoom and script type
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation
    const baseSize = 0.26 + Math.max(0, (26 - z) * 0.0088);
    
    // Adjust size for different scripts
    const sizeAdjustment = isDevanagari.current ? 0.1 : 
                           isNonLatin.current ? 0.05 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.6), 0.23);
  }, [cameraZoom, isNonLatin.current, isDevanagari.current]);

  // Don't render if not supposed to be shown
  if (!isVisible.current) return null;
  
  // Fail-safe for missing text
  if (!displayText) return null;

  // Adjust vertical positioning based on script type
  let verticalPosition = type === 'entity' ? 0.9 : 0.8;
  
  // Position adjustments for different scripts
  if (isDevanagari.current) {
    verticalPosition += 0.25; // Higher position for Devanagari
  } else if (isNonLatin.current) {
    verticalPosition += 0.1; // Slightly higher for other non-Latin
  }
  
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  return (
    <ThreeDimensionalText
      text={displayText}
      position={labelPosition}
      color={type === 'entity' ? '#ffffff' : themeHex}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={isVisible.current}
    />
  );
};

export default NodeLabel;
