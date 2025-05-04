
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { currentLanguage, forceRetranslate } = useTranslation();
  const [localTranslatedText, setLocalTranslatedText] = useState<string | undefined>(translatedText);
  const prevTranslatedText = useRef<string | undefined>(translatedText);
  const prevLanguageRef = useRef<string>(currentLanguage);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const stableVisibilityRef = useRef<boolean>(shouldShowLabel);
  
  // Effect to detect language changes and force retranslation if needed
  useEffect(() => {
    const handleLanguageChange = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.language !== prevLanguageRef.current) {
        console.log(`NodeLabel: Language changed to ${detail.language}, retranslating node "${id}"`);
        prevLanguageRef.current = detail.language;
        
        // For Hindi specifically, we want to ensure translation happens
        if (detail.language === 'hi' && id) {
          try {
            // Force retranslate this node label
            const newTranslation = await forceRetranslate(id);
            if (newTranslation && newTranslation !== id) {
              console.log(`NodeLabel: Retranslated "${id}" to "${newTranslation}"`);
              setLocalTranslatedText(newTranslation);
            }
          } catch (error) {
            console.error(`NodeLabel: Failed to retranslate node "${id}"`, error);
          }
        }
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [id, forceRetranslate]);
  
  // Update local translated text when prop changes
  useEffect(() => {
    if (translatedText !== prevTranslatedText.current) {
      setLocalTranslatedText(translatedText);
      prevTranslatedText.current = translatedText;
    }
  }, [translatedText]);
  
  // Format entity text for display - always apply for entity type
  const formattedText = useMemo(() => {
    // Only format entity nodes - this ensures we get two lines for circular nodes
    if (type === 'entity') {
      // Use translated text if available (either from props or local state), otherwise use id
      const textToFormat = localTranslatedText || translatedText || id;
      console.log(`Formatting entity text for ${id}: "${textToFormat}"`);
      return formatEntityText(textToFormat);
    }
    // For emotion nodes, just use the translated text or id directly
    return localTranslatedText || translatedText || id;
  }, [id, type, translatedText, localTranslatedText]);
  
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
    const textToCheck = localTranslatedText || translatedText;
    
    if (textToCheck && textToCheck !== prevTranslatedText.current) {
      isNonLatin.current = containsNonLatinScript(textToCheck);
      isDevanagari.current = containsDevanagari(textToCheck);
      prevTranslatedText.current = textToCheck;
      
      // Debug logging for Hindi text issues
      if (isDevanagari.current) {
        console.log(`Hindi text detected in node "${id}": "${textToCheck}", applying special rendering`);
      }
    }
  }, [id, localTranslatedText, translatedText]);

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
    
  // Use the most reliable translation source with fallbacks
  const textToDisplay = formattedText || localTranslatedText || translatedText || id;

  return (
    <ThreeDimensionalText
      text={textToDisplay}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={stableVisibilityRef.current}
      // Set skipTranslation to true since we're already handling translation at this level
      skipTranslation={true}
    />
  );
};

export default NodeLabel;
