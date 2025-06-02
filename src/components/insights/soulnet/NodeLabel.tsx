
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { fontService } from '@/utils/fontService';

// Enhanced adaptive text color with better contrast
const getAdaptiveTextColor = (nodeColor: string, nodeType: 'entity' | 'emotion', theme: string, isHighlighted: boolean, isSelected: boolean): string => {
  if (isSelected) {
    return theme === 'light' ? '#000000' : '#ffffff';
  }
  
  if (isHighlighted) {
    if (nodeType === 'emotion') {
      return theme === 'light' ? '#2563eb' : '#60a5fa';
    } else {
      return theme === 'light' ? '#dc2626' : '#f87171';
    }
  }
  
  return theme === 'light' ? '#666666' : '#999999';
};

// Enhanced label offset calculation
const calculateLabelOffset = (nodeType: 'entity' | 'emotion', nodeScale: number): number => {
  if (nodeType === 'entity') {
    const sphereRadius = 1.4;
    return sphereRadius * nodeScale * 1.3;
  } else {
    const cubeSize = 2.1;
    const cornerDistance = Math.sqrt(3) * (cubeSize / 2);
    return cornerDistance * nodeScale * 1.3;
  }
};

// Enhanced entity text formatting
const formatEntityText = (text: string): string => {
  if (!text || text.length <= 4) return text;
  
  const words = text.trim().split(/\s+/);
  
  if (words.length === 1) {
    const word = words[0];
    if (word.length <= 8) return word;
    
    const midPoint = Math.ceil(word.length / 2);
    return word.substring(0, midPoint) + '\n' + word.substring(midPoint);
  }
  
  if (words.length === 2) {
    return words.join('\n');
  }
  
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
  const [isTranslationReady, setIsTranslationReady] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const translationInProgress = useRef<boolean>(false);
  const mounted = useRef<boolean>(true);
  const scriptTypeRef = useRef<string>('latin');
  
  console.log(`[NodeLabel] Processing label for node ${id}, language: ${currentLanguage}, shouldShow: ${shouldShowLabel}`);
  
  // Stabilized visibility logic to prevent flickering
  const isVisible = useMemo(() => {
    return shouldShowLabel || forceVisible || isSelected || isHighlighted;
  }, [shouldShowLabel, forceVisible, isSelected, isHighlighted]);
  
  // Enhanced font loading detection using the font service
  useEffect(() => {
    let mounted = true;
    
    const initializeFonts = async () => {
      try {
        console.log('[NodeLabel] Checking font readiness...');
        
        // Wait for font service to be ready
        await fontService.waitForFonts();
        
        if (mounted) {
          console.log('[NodeLabel] Fonts ready via font service');
          setFontReady(true);
        }
      } catch (error) {
        console.warn('[NodeLabel] Font loading check failed:', error);
        if (mounted) {
          setFontReady(true); // Assume ready on error
        }
      }
    };
    
    initializeFonts();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Enhanced translation handling with race condition prevention
  useEffect(() => {
    if (!isVisible || !id || !fontReady) {
      if (!fontReady) {
        console.log(`[NodeLabel] Fonts not ready, waiting...`);
      }
      return;
    }
    
    // Prevent multiple simultaneous translations
    if (translationInProgress.current) {
      console.log(`[NodeLabel] Translation already in progress for ${id}`);
      return;
    }
    
    const performTranslation = async () => {
      try {
        translationInProgress.current = true;
        
        // For English, use original text immediately
        if (currentLanguage === 'en') {
          if (mounted.current) {
            setTranslatedText(id);
            setIsTranslationReady(true);
            scriptTypeRef.current = fontService.detectScriptType(id);
            
            // Preload fonts for the detected script
            await fontService.preloadFontsForScript(scriptTypeRef.current);
            
            console.log(`[NodeLabel] Using English text: "${id}", script: ${scriptTypeRef.current}`);
          }
          return;
        }
        
        // Check cache first
        const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
        
        if (cachedTranslation && mounted.current) {
          setTranslatedText(cachedTranslation);
          setIsTranslationReady(true);
          scriptTypeRef.current = fontService.detectScriptType(cachedTranslation);
          
          // Preload fonts for the detected script
          await fontService.preloadFontsForScript(scriptTypeRef.current);
          
          console.log(`[NodeLabel] Using cached translation: "${id}" -> "${cachedTranslation}", script: ${scriptTypeRef.current}`);
          return;
        }
        
        // Translate with validation
        if (translate && mounted.current) {
          console.log(`[NodeLabel] Starting translation for: "${id}" to ${currentLanguage}`);
          
          const result = await translate(id);
          
          if (mounted.current && result && typeof result === 'string') {
            setTranslatedText(result);
            setIsTranslationReady(true);
            onDemandTranslationCache.setTranslation(id, result, currentLanguage);
            scriptTypeRef.current = fontService.detectScriptType(result);
            
            // Preload fonts for the detected script
            await fontService.preloadFontsForScript(scriptTypeRef.current);
            
            console.log(`[NodeLabel] Translation complete: "${id}" -> "${result}", script: ${scriptTypeRef.current}`);
          } else if (mounted.current) {
            // Fallback to original on invalid result
            setTranslatedText(id);
            setIsTranslationReady(true);
            scriptTypeRef.current = fontService.detectScriptType(id);
            
            // Preload fonts for the detected script
            await fontService.preloadFontsForScript(scriptTypeRef.current);
            
            console.warn(`[NodeLabel] Invalid translation result, using original: "${id}"`);
          }
        }
      } catch (error) {
        console.error(`[NodeLabel] Translation error for "${id}":`, error);
        if (mounted.current) {
          setTranslatedText(id);
          setIsTranslationReady(true);
          scriptTypeRef.current = fontService.detectScriptType(id);
          
          // Preload fonts even for fallback
          await fontService.preloadFontsForScript(scriptTypeRef.current);
        }
      } finally {
        translationInProgress.current = false;
      }
    };
    
    // Reset translation state
    setIsTranslationReady(false);
    
    // Small delay to prevent race conditions
    const translationTimer = setTimeout(() => {
      performTranslation();
    }, 50);
    
    return () => {
      clearTimeout(translationTimer);
    };
  }, [id, isVisible, currentLanguage, translate, fontReady]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);
  
  // Enhanced text formatting
  const formattedText = useMemo(() => {
    if (!translatedText) return id;
    
    if (type === 'entity') {
      return formatEntityText(translatedText);
    }
    return translatedText;
  }, [translatedText, type, id]);

  // Enhanced dynamic font sizing with script-specific adjustments
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    const baseSize = 0.35 + Math.max(0, (45 - z) * 0.007);
    
    let sizeAdjustment = 0;
    switch (scriptTypeRef.current) {
      case 'devanagari':
        sizeAdjustment = 0.12;
        break;
      case 'arabic':
      case 'bengali':
      case 'thai':
        sizeAdjustment = 0.09;
        break;
      case 'chinese':
      case 'japanese':
      case 'korean':
        sizeAdjustment = 0.06;
        break;
      default:
        sizeAdjustment = 0;
    }
    
    const minSize = 0.28;
    const maxSize = 0.65;
    
    return Math.max(Math.min(baseSize + sizeAdjustment, maxSize), minSize);
  }, [cameraZoom]);

  // Don't render until both font and translation are ready
  const shouldRender = isVisible && isTranslationReady && fontReady && formattedText;
  
  if (!shouldRender) {
    console.log(`[NodeLabel] Not rendering: isVisible=${isVisible}, translationReady=${isTranslationReady}, fontReady=${fontReady}, text="${formattedText}"`);
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
    const baseWidth = 0.03;
    const width = isSelected ? baseWidth * 3 : 
                  isHighlighted ? baseWidth * 2.2 : baseWidth * 1.8;
    
    const outlineColor = (isSelected || isHighlighted) 
      ? (theme === 'light' ? '#000000' : '#ffffff')
      : (theme === 'light' ? '#333333' : '#cccccc');
    
    return { width, color: outlineColor };
  }, [isSelected, isHighlighted, theme]);

  const labelPosition: [number, number, number] = [0, geometricOffset, 0];
  
  console.log(`[NodeLabel] Rendering stable label "${formattedText}" for ${id}, script: ${scriptTypeRef.current}, fontSize: ${dynamicFontSize}`);

  return (
    <ThreeDimensionalText
      text={formattedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      bold={isHighlighted || isSelected}
      visible={true}
      skipTranslation={true}
      outlineWidth={outlineConfig.width}
      outlineColor={outlineConfig.color}
      renderOrder={15}
    />
  );
};

export default NodeLabel;
