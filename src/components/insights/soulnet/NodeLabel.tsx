
import React, { useState, useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { simplifiedFontService } from '@/services/simplifiedFontService';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { currentLanguage, translate } = useTranslation();
  const [displayText, setDisplayText] = useState<string>(id);

  // Handle translation
  useEffect(() => {
    if (!shouldShowLabel) return;

    const translateText = async () => {
      try {
        if (currentLanguage === 'en' || !translate) {
          setDisplayText(id);
          return;
        }

        const translated = await translate(id);
        if (translated && typeof translated === 'string') {
          setDisplayText(translated);
        } else {
          setDisplayText(id);
        }
      } catch (error) {
        console.warn(`[NodeLabel] Translation failed for ${id}:`, error);
        setDisplayText(id);
      }
    };

    translateText();
  }, [id, currentLanguage, translate, shouldShowLabel]);

  // Get font URL based on text content
  const fontUrl = simplifiedFontService.getFontUrl(displayText);
  
  // Load font using React Three Fiber's useLoader
  const font = useLoader(FontLoader, fontUrl);

  // Calculate position offset
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.8 : 2.2;
    const scaledOffset = baseOffset * Math.max(0.5, Math.min(2, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale]);

  // IMPROVED: Enhanced text size calculation with restricted maximum and better scaling
  const textSize = useMemo(() => {
    // Clamp camera zoom to reasonable range
    const clampedZoom = Math.max(15, Math.min(80, cameraZoom));
    
    // Improved zoom factor calculation - inverted relationship with smoother curve
    // When zoomed in (low zoom value), font should be smaller
    // When zoomed out (high zoom value), font should be larger
    const normalizedZoom = (clampedZoom - 15) / (80 - 15); // 0 to 1
    const zoomFactor = 0.7 + (normalizedZoom * 0.3); // 0.7 to 1.0 range
    
    // Base size with type differentiation
    const baseSize = type === 'entity' ? 0.35 : 0.32;
    
    // Calculate final size with restricted maximum
    const calculatedSize = baseSize * zoomFactor;
    
    // RESTRICTED: Maximum font size limited to 0.5, minimum to 0.25
    const finalSize = Math.max(0.25, Math.min(0.5, calculatedSize));
    
    console.log(`[NodeLabel] Font size calculation for ${id}: zoom=${cameraZoom}, normalized=${normalizedZoom.toFixed(2)}, factor=${zoomFactor.toFixed(2)}, final=${finalSize.toFixed(2)}`);
    
    return finalSize;
  }, [cameraZoom, type, id]);

  // Enhanced text color with better contrast
  const textColor = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
    return '#cccccc';
  }, [isSelected, isHighlighted, type, themeHex]);

  // ENHANCED: Dynamic outline width based on text size
  const outlineWidth = useMemo(() => {
    const baseOutline = isSelected ? 0.04 : 0.02;
    // Scale outline with text size to maintain readability
    const scaleFactor = textSize / 0.4; // Normalize to base size
    return Math.max(0.01, Math.min(0.06, baseOutline * scaleFactor));
  }, [isSelected, textSize]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  if (!shouldShowLabel || !displayText || !font) {
    return null;
  }

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
      outlineWidth={outlineWidth}
      outlineColor={isSelected ? '#000000' : '#333333'}
    >
      {displayText}
    </Text>
  );
};

export default NodeLabel;
