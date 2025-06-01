
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ReliableText from './ReliableText';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';
import { consolidatedFontService } from '@/utils/consolidatedFontService';

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
  
  console.log(`[NodeLabel] Processing label for node ${id}, language: ${currentLanguage}, shouldShow: ${shouldShowLabel}`);
  
  // Stabilized visibility logic to prevent flickering
  const isVisible = useMemo(() => {
    return shouldShowLabel || forceVisible || isSelected || isHighlighted;
  }, [shouldShowLabel, forceVisible, isSelected, isHighlighted]);
  
  // Enhanced font loading detection using the consolidated font service
  useEffect(() => {
    let mounted = true;
    
    const initializeFonts = async () => {
      try {
        console.log('[NodeLabel] Checking font readiness...');
        
        await consolidatedFontService.waitForFonts();
        
        if (mounted) {
          console.log('[NodeLabel] Fonts ready via consolidated font service');
          setFontReady(true);
        }
      } catch (error) {
        console.warn('[NodeLabel] Font loading check failed:', error);
        if (mounted) {
          setFontReady(true); // Assume ready on error to prevent blocking
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
      return;
    }
    
    // Prevent multiple simultaneous translations
    if (translationInProgress.current) {
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
            console.log(`[NodeLabel] Using English text: "${id}"`);
          }
          return;
        }
        
        // Check cache first
        const cachedTranslation = onDemandTranslationCache.getTranslation(id, currentLanguage);
        
        if (cachedTranslation && mounted.current) {
          setTranslatedText(cachedTranslation);
          setIsTranslationReady(true);
          console.log(`[NodeLabel] Using cached translation: "${id}" -> "${cachedTranslation}"`);
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
            console.log(`[NodeLabel] Translation complete: "${id}" -> "${result}"`);
          } else if (mounted.current) {
            // Fallback to original on invalid result
            setTranslatedText(id);
            setIsTranslationReady(true);
            console.warn(`[NodeLabel] Invalid translation result, using original: "${id}"`);
          }
        }
      } catch (error) {
        console.error(`[NodeLabel] Translation error for "${id}":`, error);
        if (mounted.current) {
          setTranslatedText(id);
          setIsTranslationReady(true);
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

  // Enhanced dynamic font sizing
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    const baseSize = 0.35 + Math.max(0, (45 - z) * 0.007);
    const minSize = 0.28;
    const maxSize = 0.65;
    
    return Math.max(Math.min(baseSize, maxSize), minSize);
  }, [cameraZoom]);

  // Don't render until both font and translation are ready
  const shouldRender = isVisible && isTranslationReady && fontReady && translatedText;
  
  if (!shouldRender) {
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
  
  console.log(`[NodeLabel] Rendering stable label "${translatedText}" for ${id}, fontSize: ${dynamicFontSize}`);

  return (
    <ReliableText
      text={translatedText}
      position={labelPosition}
      color={textColor}
      size={dynamicFontSize}
      visible={true}
      renderOrder={15}
      bold={isHighlighted || isSelected}
      outlineWidth={outlineConfig.width}
      outlineColor={outlineConfig.color}
      maxWidth={25}
    />
  );
};

export default NodeLabel;
