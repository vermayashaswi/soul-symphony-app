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

// Calculate relative luminance for adaptive text color
const calculateLuminance = (color: string): number => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Apply gamma correction
  const sRGBtoLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  const rLinear = sRGBtoLinear(r);
  const gLinear = sRGBtoLinear(g);
  const bLinear = sRGBtoLinear(b);
  
  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

// Enhanced adaptive text color with distinct colors for different node states
const getAdaptiveTextColor = (nodeColor: string, nodeType: 'entity' | 'emotion', theme: string, isHighlighted: boolean, isSelected: boolean): string => {
  // Selected node gets bright, high-contrast color
  if (isSelected) {
    return theme === 'light' ? '#000000' : '#ffffff';
  }
  
  // Connected/highlighted nodes get secondary accent color
  if (isHighlighted) {
    if (nodeType === 'emotion') {
      // For emotion nodes, use a bright accent color
      return theme === 'light' ? '#2563eb' : '#60a5fa'; // Blue accent
    } else {
      // For entity nodes, use a contrasting accent
      return theme === 'light' ? '#dc2626' : '#f87171'; // Red accent
    }
  }
  
  // Non-highlighted nodes use muted colors (existing logic)
  if (nodeType === 'emotion') {
    const luminance = calculateLuminance(nodeColor);
    return luminance > 0.5 ? '#666666' : '#999999';
  }
  
  // For non-highlighted entity nodes, use muted contrast
  return theme === 'light' ? '#666666' : '#999999';
};

// Calculate proper geometric distance for label positioning
const calculateLabelOffset = (nodeType: 'entity' | 'emotion', nodeScale: number): number => {
  if (nodeType === 'entity') {
    // For entity nodes (spheres): radius × scale × 1.25
    // Sphere radius is 1.4 from NodeMesh.tsx
    const sphereRadius = 1.4;
    return sphereRadius * nodeScale * 1.25;
  } else {
    // For emotion nodes (cubes): corner distance × scale × 1.25
    // Cube size is 2.1, so corner distance is sqrt(3) * (2.1/2) ≈ 1.82
    const cubeSize = 2.1;
    const cornerDistance = Math.sqrt(3) * (cubeSize / 2);
    return cornerDistance * nodeScale * 1.25;
  }
};

// Improved entity text formatting for better visual balance
const formatEntityText = (text: string): string => {
  if (!text || text.length <= 4) return text;
  
  // For longer entity names, create balanced two-line display
  const words = text.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word - split at natural break point
    const word = words[0];
    if (word.length <= 8) return word;
    
    const midPoint = Math.ceil(word.length / 2);
    return word.substring(0, midPoint) + '\n' + word.substring(midPoint);
  }
  
  if (words.length === 2) {
    // Two words - keep on separate lines
    return words.join('\n');
  }
  
  // Multiple words - group for balanced lines
  const totalLength = text.length;
  const targetFirstLineLength = Math.ceil(totalLength / 2);
  
  let firstLine = '';
  let wordIndex = 0;
  
  while (wordIndex < words.length && (firstLine + words[wordIndex]).length <= targetFirstLineLength) {
    firstLine += (firstLine ? ' ' : '') + words[wordIndex];
    wordIndex++;
  }
  
  const secondLine = words.slice(wordIndex).join(' ');
  return firstLine + '\n' + secondLine;
};

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  forceVisible?: boolean;
  nodeColor?: string;
  nodeScale?: number;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  forceVisible = false,
  nodeColor = '#ffffff',
  nodeScale = 1
}) => {
  const { theme } = useTheme();
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState<string>(id);
  const [isTranslating, setIsTranslating] = useState(false);
  const prevLangRef = useRef<string>(currentLanguage);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  
  // Debug logging for label positioning
  console.log(`[NodeLabel] Rendering label for node ${id}, position:`, position, 'shouldShow:', shouldShowLabel, 'forceVisible:', forceVisible);
  
  // Simple visibility logic - only show when explicitly requested
  const isVisible = shouldShowLabel || forceVisible;
  
  // Handle translation when the label should be displayed
  useEffect(() => {
    if (!isVisible || currentLanguage === 'en' || !id) {
      return;
    }
    
    // Check cache first
    const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
    
    if (cachedTranslation) {
      setTranslatedText(cachedTranslation);
      isNonLatin.current = containsNonLatinScript(cachedTranslation);
      isDevanagari.current = containsDevanagari(cachedTranslation);
      return;
    }
    
    // Translate without debouncing for immediate display
    const translateText = async () => {
      try {
        setIsTranslating(true);
        const result = await translate(id);
        setTranslatedText(result);
        
        // Cache the result
        onDemandTranslationCache.setTranslation(id, result, currentLanguage);
        
        // Update script detection
        isNonLatin.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
        
        console.log(`[NodeLabel] Translated "${id}" to "${result}"`);
      } catch (error) {
        console.error(`[NodeLabel] Failed to translate "${id}":`, error);
      } finally {
        setIsTranslating(false);
      }
    };
    
    translateText();
  }, [id, isVisible, currentLanguage, translate]);
  
  // Clear translations when language changes
  useEffect(() => {
    if (prevLangRef.current !== currentLanguage) {
      setTranslatedText(id);
      prevLangRef.current = currentLanguage;
    }
  }, [currentLanguage, id]);
  
  // Format entity text for display - always apply for entity type
  const formattedText = useMemo(() => {
    if (type === 'entity') {
      const textToFormat = translatedText || id;
      return formatEntityText(textToFormat);
    }
    return translatedText || id;
  }, [id, type, translatedText]);

  // Increased font size by 1.25x (from 0.2 base to 0.25 base)
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    // Increased base font size by 1.25x (from 0.2 to 0.25)
    const baseSize = 0.25 + Math.max(0, (45 - z) * 0.00625);
    
    // Adjust size for non-Latin scripts
    const sizeAdjustment = isDevanagari.current ? 0.05 : 
                          isNonLatin.current ? 0.03125 : 0;
    
    // Increased minimum size proportionally (from 0.15 to 0.1875)
    const minSize = 0.1875;
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.375), minSize);
  }, [cameraZoom]);

  // Don't render if not visible or no text
  if (!isVisible || !formattedText) {
    return null;
  }

  // Calculate proper geometric distance for label positioning
  const geometricOffset = useMemo(() => {
    return calculateLabelOffset(type, nodeScale);
  }, [type, nodeScale]);

  // Enhanced adaptive text color with distinct colors for different states
  const textColor = useMemo(() => {
    return getAdaptiveTextColor(nodeColor, type, theme, isHighlighted, isSelected);
  }, [nodeColor, type, theme, isHighlighted, isSelected]);

  // Enhanced outline for better visibility - stronger for selected/highlighted
  const outlineWidth = useMemo(() => {
    if (isSelected) return 0.035; // Stronger outline for selected
    if (isHighlighted) return 0.025; // Medium outline for highlighted
    return 0.01875; // Normal outline for others
  }, [isSelected, isHighlighted]);
  
  // Adaptive outline color for maximum contrast
  const outlineColor = useMemo(() => {
    if (isSelected || isHighlighted) {
      // For selected/highlighted, use stronger contrast
      const textLuminance = calculateLuminance(textColor);
      return textLuminance > 0.5 ? '#000000' : '#ffffff';
    }
    // For normal nodes, use softer outline
    return theme === 'light' ? '#000000' : '#ffffff';
  }, [textColor, isSelected, isHighlighted, theme]);

  // Use calculated geometric offset for proper positioning
  const labelPosition: [number, number, number] = [0, geometricOffset, 0];
  
  console.log(`[NodeLabel] Final label position for ${id}:`, labelPosition, 'geometric offset:', geometricOffset, 'nodeScale:', nodeScale);

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted || isSelected}
      visible={true}
      skipTranslation={true}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      renderOrder={15}
    />
  );
};

export default NodeLabel;
