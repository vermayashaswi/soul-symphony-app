
import React, { useMemo } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useFontLoading } from '@/main';

// Helper function to detect script types - consolidated into one function
const detectScriptType = (text: string): { isNonLatin: boolean, isDevanagari: boolean } => {
  if (!text) return { isNonLatin: false, isDevanagari: false };
  
  // Regex patterns for different script ranges
  const devanagariPattern = /[\u0900-\u097F]/;  // Hindi, Sanskrit, etc.
  
  // Non-Latin scripts
  const nonLatinPatterns = {
    arabic: /[\u0600-\u06FF]/,      // Arabic
    chinese: /[\u4E00-\u9FFF]/,     // Chinese
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,  // Japanese Hiragana and Katakana
    korean: /[\uAC00-\uD7AF]/,      // Korean Hangul
    cyrillic: /[\u0400-\u04FF]/,    // Russian and other Cyrillic
    thai: /[\u0E00-\u0E7F]/,        // Thai
    hebrew: /[\u0590-\u05FF]/,      // Hebrew
    greek: /[\u0370-\u03FF]/        // Greek
  };
  
  const isDevanagari = devanagariPattern.test(text);
  const isNonLatin = isDevanagari || Object.values(nonLatinPatterns).some(pattern => pattern.test(text));
  
  return { isNonLatin, isDevanagari };
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
  // Access font loading status from context if available
  const fontStatus = useFontLoading ? useFontLoading() : { 
    fontsLoaded: true, 
    fontsError: false,
    devanagariReady: true
  };
  
  // Detect script type for positioning and size adjustments
  const scriptType = useMemo(() => {
    return detectScriptType(translatedText || id);
  }, [translatedText, id]);
  
  // Check if the text might have rendering issues
  const mightHaveRenderingIssues = useMemo(() => {
    return scriptType.isDevanagari && !fontStatus.devanagariReady;
  }, [scriptType, fontStatus]);
  
  // Calculate font size with standardized approach for all scripts
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Base size calculation with minor adjustments for script type
    const baseSize = 0.26 + Math.max(0, (26 - z) * 0.0088);
    
    // Small size adjustment for non-Latin scripts
    const sizeAdjustment = scriptType.isDevanagari ? 0.04 : 
                          scriptType.isNonLatin ? 0.02 : 0;
    
    // If we might have rendering issues with this text, make it slightly larger for better readability
    const renderIssueAdjustment = mightHaveRenderingIssues ? 0.03 : 0;
    
    // Ensure size stays within reasonable bounds
    return Math.max(Math.min(baseSize + sizeAdjustment + renderIssueAdjustment, 0.5), 0.23);
  }, [cameraZoom, scriptType, mightHaveRenderingIssues]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  // Standardized vertical positioning with minor script-specific adjustments
  let verticalPosition = type === 'entity' ? 0.9 : 0.8;
  
  // Small adjustments for different script types
  if (scriptType.isDevanagari) {
    verticalPosition += 0.08;
  } else if (scriptType.isNonLatin) {
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
