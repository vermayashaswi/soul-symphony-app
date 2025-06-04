
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { universalFontService } from '@/services/universalFontService';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  nodeScale?: number;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom = 45,
  themeHex,
  nodeScale = 1
}) => {
  const { currentLanguage, translate, getCachedTranslation } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(id);

  // Enhanced translation lookup with multiple sources
  useEffect(() => {
    if (!shouldShowLabel || !id) return;

    const getTranslation = async () => {
      if (currentLanguage === 'en') {
        setDisplayText(id);
        return;
      }

      console.log(`[NodeLabel] Getting translation for "${id}" (${currentLanguage})`);

      // 1. Check translation context cache
      const contextCached = getCachedTranslation ? getCachedTranslation(id) : null;
      if (contextCached) {
        console.log(`[NodeLabel] Using context cache: "${id}" -> "${contextCached}"`);
        setDisplayText(contextCached);
        return;
      }

      // 2. Check on-demand cache
      const onDemandCached = onDemandTranslationCache.get(currentLanguage, id);
      if (onDemandCached) {
        console.log(`[NodeLabel] Using on-demand cache: "${id}" -> "${onDemandCached}"`);
        setDisplayText(onDemandCached);
        return;
      }

      // 3. Try real-time translation
      if (translate) {
        try {
          const translated = await translate(id, 'en');
          if (translated && translated !== id) {
            console.log(`[NodeLabel] Real-time translation: "${id}" -> "${translated}"`);
            setDisplayText(translated);
            return;
          }
        } catch (error) {
          console.warn(`[NodeLabel] Real-time translation failed for ${id}:`, error);
        }
      }

      // 4. Fallback to original
      console.log(`[NodeLabel] Using fallback: "${id}"`);
      setDisplayText(id);
    };

    getTranslation();
  }, [id, currentLanguage, translate, getCachedTranslation, shouldShowLabel]);

  // Get font URL based on display text and current language
  const fontUrl = universalFontService.getFontUrl(displayText, currentLanguage);
  
  // Load font using React Three Fiber's useLoader with error handling
  let font;
  try {
    font = useLoader(FontLoader, fontUrl);
  } catch (error) {
    console.warn(`[NodeLabel] Failed to load font for ${currentLanguage}, falling back to Latin`, error);
    // Fallback to Latin font
    font = useLoader(FontLoader, universalFontService.getFontUrl('fallback', 'en'));
  }

  // Calculate position offset
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.8 : 2.2;
    const scaledOffset = baseOffset * Math.max(0.5, Math.min(2, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale]);

  // Calculate text properties
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 0.4;
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    return Math.max(0.2, Math.min(0.8, baseSize * zoomFactor));
  }, [cameraZoom]);

  const textColor = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
    return '#cccccc';
  }, [isSelected, isHighlighted, type, themeHex]);

  // Enhanced outline logic for better multi-language readability
  const outlineConfig = useMemo(() => {
    const isComplex = universalFontService.isComplexScript(displayText);
    const needsOutline = isSelected || isComplex || textColor === '#ffffff';
    
    return {
      width: needsOutline ? (isSelected ? 0.04 : 0.02) : 0,
      color: isSelected ? '#000000' : '#333333'
    };
  }, [isSelected, displayText, textColor]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  if (!shouldShowLabel || !displayText || !font) {
    return null;
  }

  console.log(`[NodeLabel] Rendering: "${displayText}" (${currentLanguage}) with font support for script: ${universalFontService.detectScript(displayText)}`);

  return (
    <Text
      position={labelPosition}
      color={textColor}
      fontSize={textSize}
      anchorX="center"
      anchorY="middle"
      maxWidth={25}
      textAlign="center"
      font={font}
      fontWeight={isHighlighted || isSelected ? "bold" : "normal"}
      material-transparent={true}
      material-depthTest={false}
      renderOrder={15}
      outlineWidth={outlineConfig.width}
      outlineColor={outlineConfig.color}
    >
      {displayText}
    </Text>
  );
};

export default NodeLabel;
