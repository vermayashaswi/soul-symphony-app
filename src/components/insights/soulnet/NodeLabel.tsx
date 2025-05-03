
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
  const visibilityTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Stabilize visibility transitions to prevent flickering
  useEffect(() => {
    // For Devanagari text, we want to ensure stability
    if (isDevanagari.current) {
      if (shouldShowLabel !== stableVisibilityRef.current) {
        // Only update if going from invisible to visible immediately
        if (shouldShowLabel) {
          stableVisibilityRef.current = true;
          
          // Clear any existing timeout to prevent conflicts
          if (visibilityTimeout.current) {
            clearTimeout(visibilityTimeout.current);
            visibilityTimeout.current = null;
          }
        } else {
          // Use a longer delay for hiding Devanagari text
          if (visibilityTimeout.current) {
            clearTimeout(visibilityTimeout.current);
          }
          
          visibilityTimeout.current = setTimeout(() => {
            stableVisibilityRef.current = false;
            visibilityTimeout.current = null;
          }, 300); // Longer delay for Hindi text
        }
      }
    } else {
      // For non-Hindi text, transition more quickly
      stableVisibilityRef.current = shouldShowLabel;
    }
    
    // Cleanup timeouts on unmount
    return () => {
      if (visibilityTimeout.current) {
        clearTimeout(visibilityTimeout.current);
      }
    };
  }, [shouldShowLabel]);
  
  // Check if text contains non-Latin script and memoize the result
  useEffect(() => {
    if (translatedText && translatedText !== prevTranslatedText.current) {
      const hasDevanagari = containsDevanagari(translatedText);
      const hasNonLatin = containsNonLatinScript(translatedText) || hasDevanagari;
      
      isNonLatin.current = hasNonLatin;
      isDevanagari.current = hasDevanagari;
      prevTranslatedText.current = translatedText;
      
      // Log detection of Hindi text
      if (hasDevanagari) {
        console.log(`Hindi/Devanagari text detected in node "${id}": "${translatedText}", applying special rendering`);
      }
    }
  }, [translatedText, id]);

  // Use fallback when translation is missing
  const displayText = useMemo(() => {
    if (!translatedText && id) {
      console.log(`Using fallback text for node "${id}" since translation is missing`);
      return id;
    }
    return translatedText || id;
  }, [translatedText, id]);

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation adjusted by 30%
    const baseSize = 0.26 + Math.max(0, (26 - z) * 0.0088);
    
    // Adjust size for non-Latin scripts - they often need slightly bigger font
    // Devanagari (Hindi) scripts need even larger adjustment
    const sizeAdjustment = isDevanagari.current ? 0.1 : 
                           isNonLatin.current ? 0.05 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.6), 0.23);
  }, [cameraZoom, isNonLatin.current, isDevanagari.current]);

  // Don't render if not supposed to be shown
  if (!stableVisibilityRef.current) return null;

  // Adjust vertical positioning for different script types
  let verticalPosition = type === 'entity' ? 0.9 : 0.8;
  
  // For Devanagari text, position significantly higher to accommodate taller characters
  if (isDevanagari.current) {
    verticalPosition += 0.2;
  } else if (isNonLatin.current) {
    verticalPosition += 0.08;
  }
  
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  return (
    <ThreeDimensionalText
      text={displayText}
      position={labelPosition}
      color={type === 'entity' ? '#ffffff' : themeHex}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={stableVisibilityRef.current}
    />
  );
};

export default NodeLabel;
