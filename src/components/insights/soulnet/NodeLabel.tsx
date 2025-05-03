
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
  const prevTranslatedText = useRef<string | undefined>(translatedText);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const stableVisibilityRef = useRef<boolean>(shouldShowLabel);
  
  // Stabilize visibility transitions to prevent flickering
  useEffect(() => {
    // For Devanagari text, we want to delay visibility changes to prevent flickering
    if (isDevanagari.current) {
      if (shouldShowLabel !== stableVisibilityRef.current) {
        // Only update if going from invisible to visible immediately
        if (shouldShowLabel) {
          stableVisibilityRef.current = true;
        } else {
          // Delay hiding to prevent flicker during transitions
          setTimeout(() => {
            stableVisibilityRef.current = false;
          }, 100);
        }
      }
    } else {
      stableVisibilityRef.current = shouldShowLabel;
    }
  }, [shouldShowLabel]);
  
  // Check if text contains non-Latin script and memoize the result
  useEffect(() => {
    if (translatedText && translatedText !== prevTranslatedText.current) {
      isNonLatin.current = containsNonLatinScript(translatedText);
      isDevanagari.current = containsDevanagari(translatedText);
      prevTranslatedText.current = translatedText;
      
      // Debug logging for Hindi text issues
      if (isDevanagari.current) {
        console.log(`Hindi/Devanagari text detected in node "${id}": "${translatedText}", applying special rendering`);
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
    const sizeAdjustment = isDevanagari.current ? 0.08 : 
                           isNonLatin.current ? 0.03 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.5), 0.23);
  }, [cameraZoom, isNonLatin.current, isDevanagari.current]);

  // Don't render if not supposed to be shown
  if (!stableVisibilityRef.current) return null;

  // Adjust vertical positioning for different script types
  let verticalPosition = type === 'entity' ? 0.9 : 0.8;
  
  // For Devanagari text, position slightly higher to accommodate taller characters
  if (isDevanagari.current) {
    verticalPosition += 0.15;
  } else if (isNonLatin.current) {
    verticalPosition += 0.05;
  }
  
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  return (
    <ThreeDimensionalText
      text={translatedText || id}
      position={labelPosition}
      color={type === 'entity' ? '#ffffff' : themeHex}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={stableVisibilityRef.current}
    />
  );
};

export default NodeLabel;
