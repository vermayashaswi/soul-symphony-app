import React, { useMemo, useRef, useEffect } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';

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
  const { theme } = useTheme();
  console.log(`NodeLabel for "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}, type=${type}, translatedText=${translatedText}`);
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
        // For hiding, delay briefly to prevent flickering during transitions
        if (shouldShowLabel) {
          stableVisibilityRef.current = true;
        } else {
          // Small timeout to prevent flicker during state transitions
          setTimeout(() => {
            stableVisibilityRef.current = false;
          }, 50);
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
        console.log(`Hindi text detected in node "${id}": "${translatedText}", applying special rendering`);
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
    const sizeAdjustment = isDevanagari.current ? 0.06 : 
                           isNonLatin.current ? 0.03 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.5), 0.23);
  }, [cameraZoom, isNonLatin.current, isDevanagari.current]);

  // Don't render if not supposed to be shown
  if (!stableVisibilityRef.current) return null;

  // Adjust vertical positioning for different script types
  // Move the label position further out to accommodate the larger font size
  let verticalPosition = type === 'entity' ? 1.4 : 1.3; // Increased from 0.9/0.8 to account for larger font
  
  // For Devanagari text, position slightly higher to accommodate taller characters
  if (isDevanagari.current) {
    verticalPosition += 0.2; // Increased from 0.1 for larger font
  } else if (isNonLatin.current) {
    verticalPosition += 0.1; // Increased from 0.05 for larger font
  }
  
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  // Determine text color based on theme for entity nodes
  const textColor = type === 'entity' 
    ? (theme === 'light' ? '#000000' : '#ffffff')  // Black in light mode, white in dark mode
    : themeHex;

  return (
    <ThreeDimensionalText
      text={translatedText || id}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={stableVisibilityRef.current}
      // Skip the translation in ThreeDimensionalText since we're using pre-translated text
      skipTranslation={!!translatedText}
    />
  );
};

export default NodeLabel;
