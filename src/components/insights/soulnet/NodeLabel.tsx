
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';

// Enhanced script detection
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  const patterns = {
    devanagari: /[\u0900-\u097F]/,
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/,
    cyrillic: /[\u0400-\u04FF]/,
    thai: /[\u0E00-\u0E7F]/,
    bengali: /[\u0980-\u09FF]/,
    gujarati: /[\u0A80-\u0AFF]/,
    gurmukhi: /[\u0A00-\u0A7F]/,
    kannada: /[\u0C80-\u0CFF]/,
    malayalam: /[\u0D00-\u0D7F]/,
    oriya: /[\u0B00-\u0B7F]/,
    tamil: /[\u0B80-\u0BFF]/,
    telugu: /[\u0C00-\u0C7F]/
  };
  
  return Object.values(patterns).some(pattern => pattern.test(text));
};

const containsDevanagari = (text: string): boolean => {
  if (!text) return false;
  const devanagariPattern = /[\u0900-\u097F]/;
  return devanagariPattern.test(text);
};

// Detect specific script type
const detectScriptType = (text: string): string => {
  if (!text) return 'latin';
  
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'chinese';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'thai';
  
  return 'latin';
};

// Enhanced adaptive text color with better contrast
const getAdaptiveTextColor = (nodeColor: string, nodeType: 'entity' | 'emotion', theme: string, isHighlighted: boolean, isSelected: boolean): string => {
  // Selected node gets maximum contrast
  if (isSelected) {
    return theme === 'light' ? '#000000' : '#ffffff';
  }
  
  // Highlighted nodes get distinct accent colors
  if (isHighlighted) {
    if (nodeType === 'emotion') {
      return theme === 'light' ? '#2563eb' : '#60a5fa';
    } else {
      return theme === 'light' ? '#dc2626' : '#f87171';
    }
  }
  
  // Non-highlighted nodes use muted colors
  return theme === 'light' ? '#666666' : '#999999';
};

// Enhanced label offset calculation
const calculateLabelOffset = (nodeType: 'entity' | 'emotion', nodeScale: number): number => {
  if (nodeType === 'entity') {
    // For spheres: radius × scale × spacing factor
    const sphereRadius = 1.4;
    return sphereRadius * nodeScale * 1.3; // Increased spacing factor
  } else {
    // For cubes: corner distance × scale × spacing factor
    const cubeSize = 2.1;
    const cornerDistance = Math.sqrt(3) * (cubeSize / 2);
    return cornerDistance * nodeScale * 1.3; // Increased spacing factor
  }
};

// Enhanced entity text formatting
const formatEntityText = (text: string): string => {
  if (!text || text.length <= 4) return text;
  
  const words = text.trim().split(/\s+/);
  
  if (words.length === 1) {
    const word = words[0];
    if (word.length <= 8) return word;
    
    // Better word breaking for longer single words
    const midPoint = Math.ceil(word.length / 2);
    return word.substring(0, midPoint) + '\n' + word.substring(midPoint);
  }
  
  if (words.length === 2) {
    return words.join('\n');
  }
  
  // Improved multi-word grouping
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
  const [hasTranslationError, setHasTranslationError] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const prevLangRef = useRef<string>(currentLanguage);
  const isNonLatin = useRef<boolean>(false);
  const isDevanagari = useRef<boolean>(false);
  const scriptType = useRef<string>('latin');
  
  console.log(`[NodeLabel] Processing label for node ${id}, shouldShow: ${shouldShowLabel}, forceVisible: ${forceVisible}`);
  
  // Simplified visibility logic
  const isVisible = shouldShowLabel || forceVisible;
  
  // Font loading detection
  useEffect(() => {
    const checkFontLoading = async () => {
      try {
        console.log('[NodeLabel] Checking font loading status');
        
        if (document.fonts) {
          await document.fonts.ready;
          console.log('[NodeLabel] Document fonts are ready');
          setFontLoaded(true);
        } else {
          console.log('[NodeLabel] Document.fonts not supported, assuming fonts loaded');
          setFontLoaded(true);
        }
      } catch (error) {
        console.warn('[NodeLabel] Font loading check failed:', error);
        setFontLoaded(true);
      }
    };
    
    checkFontLoading();
  }, []);
  
  // Enhanced translation handling with error recovery
  useEffect(() => {
    if (!isVisible || currentLanguage === 'en' || !id) {
      setTranslatedText(id);
      isNonLatin.current = containsNonLatinScript(id);
      isDevanagari.current = containsDevanagari(id);
      scriptType.current = detectScriptType(id);
      console.log(`[NodeLabel] Using original text: "${id}", detected script: ${scriptType.current}`);
      return;
    }
    
    // Check cache first
    const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
    
    if (cachedTranslation) {
      setTranslatedText(cachedTranslation);
      isNonLatin.current = containsNonLatinScript(cachedTranslation);
      isDevanagari.current = containsDevanagari(cachedTranslation);
      scriptType.current = detectScriptType(cachedTranslation);
      setHasTranslationError(false);
      console.log(`[NodeLabel] Using cached translation for "${id}": "${cachedTranslation}", detected script: ${scriptType.current}`);
      return;
    }
    
    // Translate with enhanced error handling
    const translateText = async () => {
      try {
        setIsTranslating(true);
        setHasTranslationError(false);
        
        const result = await translate(id);
        
        // Validate translation result
        if (!result || typeof result !== 'string' || result.trim().length === 0) {
          throw new Error('Invalid translation result');
        }
        
        setTranslatedText(result);
        onDemandTranslationCache.setTranslation(id, result, currentLanguage);
        
        isNonLatin.current = containsNonLatinScript(result);
        isDevanagari.current = containsDevanagari(result);
        scriptType.current = detectScriptType(result);
        
        console.log(`[NodeLabel] Successfully translated "${id}" to "${result}", detected script: ${scriptType.current}`);
      } catch (error) {
        console.error(`[NodeLabel] Translation failed for "${id}":`, error);
        setHasTranslationError(true);
        
        // Use original text as fallback
        setTranslatedText(id);
        isNonLatin.current = containsNonLatinScript(id);
        isDevanagari.current = containsDevanagari(id);
        scriptType.current = detectScriptType(id);
        
        console.log(`[NodeLabel] Using fallback text: "${id}", detected script: ${scriptType.current}`);
      } finally {
        setIsTranslating(false);
      }
    };
    
    translateText();
  }, [id, isVisible, currentLanguage, translate]);
  
  // Reset translation when language changes
  useEffect(() => {
    if (prevLangRef.current !== currentLanguage) {
      setTranslatedText(id);
      setHasTranslationError(false);
      prevLangRef.current = currentLanguage;
    }
  }, [currentLanguage, id]);
  
  // Enhanced text formatting
  const formattedText = useMemo(() => {
    if (type === 'entity') {
      const textToFormat = translatedText || id;
      return formatEntityText(textToFormat);
    }
    return translatedText || id;
  }, [id, type, translatedText]);

  // Enhanced dynamic font sizing with script-specific adjustments
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    // Increased base font size for better readability
    const baseSize = 0.3 + Math.max(0, (45 - z) * 0.00625);
    
    // Enhanced script-specific adjustments
    let sizeAdjustment = 0;
    switch (scriptType.current) {
      case 'devanagari':
        sizeAdjustment = 0.1; // Larger adjustment for Devanagari
        break;
      case 'arabic':
      case 'bengali':
      case 'thai':
        sizeAdjustment = 0.08;
        break;
      case 'chinese':
      case 'japanese':
      case 'korean':
        sizeAdjustment = 0.05;
        break;
      default:
        sizeAdjustment = 0;
    }
    
    const minSize = 0.25; // Increased minimum size
    const maxSize = 0.6;  // Increased maximum size limit for better visibility
    
    return Math.max(Math.min(baseSize + sizeAdjustment, maxSize), minSize);
  }, [cameraZoom]);

  // Don't render if not visible or invalid text
  if (!isVisible || !formattedText) {
    return null;
  }

  // Enhanced geometric positioning
  const geometricOffset = useMemo(() => {
    return calculateLabelOffset(type, nodeScale);
  }, [type, nodeScale]);

  // Enhanced adaptive text color
  const textColor = useMemo(() => {
    return getAdaptiveTextColor(nodeColor, type, theme, isHighlighted, isSelected);
  }, [nodeColor, type, theme, isHighlighted, isSelected]);

  // Enhanced outline configuration
  const outlineConfig = useMemo(() => {
    const baseWidth = 0.025; // Increased base width for better visibility
    const width = isSelected ? baseWidth * 2.5 : 
                  isHighlighted ? baseWidth * 2 : baseWidth * 1.5;
    
    // Enhanced contrast calculation for outline color
    const outlineColor = (isSelected || isHighlighted) 
      ? (theme === 'light' ? '#000000' : '#ffffff')
      : (theme === 'light' ? '#333333' : '#cccccc');
    
    return { width, color: outlineColor };
  }, [isSelected, isHighlighted, theme]);

  const labelPosition: [number, number, number] = [0, geometricOffset, 0];
  
  console.log(`[NodeLabel] Rendering label "${formattedText}" at offset ${geometricOffset}, 
    isTranslating: ${isTranslating}, hasError: ${hasTranslationError}, fontLoaded: ${fontLoaded}, 
    script: ${scriptType.current}, fontSize: ${dynamicFontSize}`);

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted || isSelected}
      visible={true}
      skipTranslation={true} // Always skip since we handle translation here
      outlineWidth={outlineConfig.width}
      outlineColor={outlineConfig.color}
      renderOrder={15}
    />
  );
};

export default NodeLabel;
