
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

// Get adaptive text color based on node color and type
const getAdaptiveTextColor = (nodeColor: string, nodeType: 'entity' | 'emotion', theme: string, isHighlighted: boolean): string => {
  if (nodeType === 'emotion') {
    // For emotion nodes, use the theme color but ensure contrast
    const luminance = calculateLuminance(nodeColor);
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
  
  // For entity nodes (typically white/gray)
  if (isHighlighted) {
    return theme === 'light' ? '#000000' : '#ffffff';
  }
  
  // For non-highlighted entity nodes, use high contrast
  return theme === 'light' ? '#1a1a1a' : '#ffffff';
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
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  forceVisible?: boolean;
  nodeColor?: string;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  forceVisible = false,
  nodeColor = '#ffffff'
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

  // Reduced font sizing by 75% to match user request
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    // Reduced base font size by 75% (from 0.8 to 0.2)
    const baseSize = 0.2 + Math.max(0, (45 - z) * 0.005);
    
    // Adjust size for non-Latin scripts
    const sizeAdjustment = isDevanagari.current ? 0.04 : 
                          isNonLatin.current ? 0.025 : 0;
    
    // Reduced minimum size proportionally (from 0.6 to 0.15)
    const minSize = 0.15;
    return Math.max(Math.min(baseSize + sizeAdjustment, 0.3), minSize);
  }, [cameraZoom]);

  // Don't render if not visible or no text
  if (!isVisible || !formattedText) {
    return null;
  }

  // FIXED: Increased vertical offset to prevent label overlap
  const verticalOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 0.22 : 0.18; // Increased from 0.15/0.1
    return baseOffset;
  }, [type]);

  // Adaptive text color based on node color and type
  const textColor = useMemo(() => {
    return getAdaptiveTextColor(nodeColor, type, theme, isHighlighted);
  }, [nodeColor, type, theme, isHighlighted]);

  // Enhanced outline for better visibility
  const outlineWidth = useMemo(() => {
    return isHighlighted ? 0.02 : 0.015; // Increased outline width
  }, [isHighlighted]);
  
  // Adaptive outline color for maximum contrast
  const outlineColor = useMemo(() => {
    const textLuminance = calculateLuminance(textColor);
    return textLuminance > 0.5 ? '#000000' : '#ffffff';
  }, [textColor]);

  // FIXED: Use relative positioning instead of absolute world position
  const labelPosition: [number, number, number] = [0, verticalOffset, 0];
  
  console.log(`[NodeLabel] Final label position for ${id}:`, labelPosition, 'offset:', verticalOffset);

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={true}
      skipTranslation={true}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      renderOrder={15}
    />
  );
};

export default NodeLabel;
