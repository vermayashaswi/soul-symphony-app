
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
  const prevTranslatedText = useRef<string | undefined>(translatedText);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const stableVisibilityRef = useRef<boolean>(shouldShowLabel);
  const textToDisplay = useRef<string>(translatedText || id);
  
  // Format entity text for display - always apply for entity type
  const formattedText = useMemo(() => {
    // Always use the most recent translated text if available
    const textToFormat = translatedText || id;
    console.log(`Formatting ${type} text for ${id}: "${textToFormat}"`);
    
    // Only format entity nodes - this ensures we get two lines for circular nodes
    if (type === 'entity') {
      return formatEntityText(textToFormat);
    }
    
    // For emotion nodes, just use the text directly
    return textToFormat;
  }, [id, type, translatedText]);
  
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
    // Update text display with new translations when they become available
    if (translatedText && translatedText !== prevTranslatedText.current) {
      isNonLatin.current = containsNonLatinScript(translatedText);
      isDevanagari.current = containsDevanagari(translatedText);
      prevTranslatedText.current = translatedText;
      textToDisplay.current = translatedText;
      
      // Debug logging for Hindi text issues
      if (isDevanagari.current) {
        console.log(`Hindi text detected in node "${id}": "${translatedText}", applying special rendering`);
      }
    }
  }, [translatedText, id]);

  // Use previous translation if current one is not available
  useEffect(() => {
    // If we don't have a translation yet, check if we had one before
    if (!translatedText && prevTranslatedText.current) {
      console.log(`Using previous translation for "${id}" while loading new one`);
      textToDisplay.current = prevTranslatedText.current;
    } else if (translatedText) {
      textToDisplay.current = translatedText;
    } else {
      textToDisplay.current = id;
    }
  }, [translatedText, id]);

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation - decreased by 0.75x
    const baseSize = (0.26 + Math.max(0, (26 - z) * 0.0088)) * 0.75;
    
    // Adjust size for non-Latin scripts - they often need slightly bigger font
    // Devanagari (Hindi) scripts need even larger adjustment
    const sizeAdjustment = isDevanagari.current ? 0.06 * 0.75 : 
                          isNonLatin.current ? 0.03 * 0.75 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.5), 0.18);
  }, [cameraZoom]);

  // Don't render if not supposed to be shown
  if (!stableVisibilityRef.current) return null;

  // Adjust vertical positioning for different script types and node types
  // Also adjusted for smaller node sizes
  let verticalPosition = type === 'entity' ? 1.45 : 1.1; // Decreased from 1.8/1.3 to account for smaller nodes
  
  // For Devanagari text, position slightly higher to accommodate taller characters
  if (isDevanagari.current) {
    verticalPosition += 0.15; // Decreased from 0.2
  } else if (isNonLatin.current) {
    verticalPosition += 0.08; // Decreased from 0.1
  }
  
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  // Determine text color based on theme for entity nodes
  const textColor = type === 'entity' 
    ? (theme === 'light' ? '#000000' : '#ffffff')  // Black in light mode, white in dark mode
    : themeHex;

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={stableVisibilityRef.current}
      skipTranslation={true}
    />
  );
};

export default NodeLabel;
