
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
  const stableVisibilityRef = useRef<boolean>(shouldShowLabel);
  const translationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle translation when the label should be displayed
  useEffect(() => {
    if (!shouldShowLabel || currentLanguage === 'en' || !id) {
      return;
    }
    
    // Check cache first
    const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
    
    if (cachedTranslation) {
      setTranslatedText(cachedTranslation);
      // Also analyze and store script info
      isNonLatin.current = containsNonLatinScript(cachedTranslation);
      isDevanagari.current = containsDevanagari(cachedTranslation);
      return;
    }
    
    // Debounce translation requests to avoid overwhelming the translation service
    // especially when many labels are visible at once
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
    
    translationTimeoutRef.current = setTimeout(async () => {
      try {
        setIsTranslating(true);
        const result = await translate(id);
        setTranslatedText(result);
        
        // Cache the result
        onDemandTranslationCache.setTranslation(id, result, currentLanguage);
        
        // Update script detection
        isNonLatin.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
        
        // Debug logging for Hindi text issues
        if (isDevanagari.current) {
          console.log(`Hindi text detected in node "${id}": "${result}", applying special rendering`);
        }
      } catch (error) {
        console.error(`Failed to translate node label "${id}":`, error);
      } finally {
        setIsTranslating(false);
      }
    }, 100); // Small delay to prevent too many simultaneous requests
    
    return () => {
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
    };
  }, [id, shouldShowLabel, currentLanguage, translate]);
  
  // Clear translations when language changes
  useEffect(() => {
    if (prevLangRef.current !== currentLanguage) {
      // Reset to original text when language changes
      setTranslatedText(id);
      prevLangRef.current = currentLanguage;
    }
  }, [currentLanguage, id]);
  
  // Format entity text for display - always apply for entity type
  const formattedText = useMemo(() => {
    // Only format entity nodes - this ensures we get two lines for circular nodes
    if (type === 'entity') {
      const textToFormat = translatedText || id;
      return formatEntityText(textToFormat);
    }
    // For emotion nodes, just use the translated text or id directly
    return translatedText || id;
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

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation - decreased by 0.75x and then multiplied by 0.8
    const baseSize = (0.26 + Math.max(0, (26 - z) * 0.0088)) * 0.75 * 0.8; // Using 0.8 instead of 0.5
    
    // Adjust size for non-Latin scripts - they often need slightly bigger font
    // Devanagari (Hindi) scripts need even larger adjustment
    const sizeAdjustment = isDevanagari.current ? 0.06 * 0.75 * 0.8 : // Also using 0.8 instead of 0.5
                          isNonLatin.current ? 0.03 * 0.75 * 0.8 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.4), 0.15); // Adjusted bounds for 0.8 scale
  }, [cameraZoom]);

  // Don't render if not supposed to be shown
  if (!stableVisibilityRef.current) return null;

  // Adjust vertical positioning for different script types and node types
  // Increased distance for circular nodes (entity type) to 1.5r
  let verticalPosition = type === 'entity' ? 2.2 : 1.1; // Increased from 1.45 to 2.2 for entity nodes
  
  // For Devanagari text, position slightly higher to accommodate taller characters
  if (isDevanagari.current) {
    verticalPosition += 0.15 * 0.8; // Adjusted for new scale
  } else if (isNonLatin.current) {
    verticalPosition += 0.08 * 0.8; // Adjusted for new scale
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
      // Set skipTranslation to true since we're handling it directly here
      skipTranslation={true}
    />
  );
};

export default NodeLabel;
