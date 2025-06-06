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

  // RESTRICTED: Font sizing limited to 0.2-0.4 range as requested
  const textSize = useMemo(() => {
    // Clamp camera zoom to reasonable range for better control
    const clampedZoom = Math.max(15, Math.min(80, cameraZoom));
    
    // IMPROVED: More controlled zoom factor calculation with reduced scaling impact
    const normalizedZoom = (clampedZoom - 15) / (80 - 15); // 0 to 1
    
    // RESTRICTED: Smaller scaling range to prevent dramatic size changes
    const zoomFactor = 0.85 + (normalizedZoom * 0.15); // 0.85 to 1.0 range (only 17% variation)
    
    // UPDATED: Reduced base sizes to fit within 0.2-0.4 range
    const baseSize = type === 'entity' ? 0.35 : 0.32;
    
    // Calculate size with controlled scaling
    const calculatedSize = baseSize * zoomFactor;
    
    // RESTRICTED: Font size limited to 0.2-0.4 range as requested
    const finalSize = Math.max(0.2, Math.min(0.4, calculatedSize));
    
    console.log(`[NodeLabel] RESTRICTED sizing for ${id}: zoom=${cameraZoom}, normalized=${normalizedZoom.toFixed(2)}, factor=${zoomFactor.toFixed(2)}, final=${finalSize.toFixed(2)} (range: 0.2-0.4)`);
    
    return finalSize;
  }, [cameraZoom, type, id]);

  // Enhanced text color with better contrast and readability
  const textColor = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
    return '#cccccc';
  }, [isSelected, isHighlighted, type, themeHex]);

  // ENHANCED: Proportional outline width that scales with text size but remains controlled
  const outlineWidth = useMemo(() => {
    const baseOutline = isSelected ? 0.04 : 0.02;
    // Scale outline proportionally but keep it reasonable
    const scaleFactor = Math.min(1.2, textSize / 0.35); // Cap scaling at 1.2x
    const calculatedOutline = baseOutline * scaleFactor;
    
    // Restrict outline width to prevent excessive thickness
    return Math.max(0.015, Math.min(0.05, calculatedOutline));
  }, [isSelected, textSize]);

  // IMPROVED: Better text wrapping based on actual text size
  const maxWidth = useMemo(() => {
    // Dynamic max width based on text size for better text wrapping
    const baseWidth = 25;
    const sizeRatio = textSize / 0.4;
    return Math.max(20, Math.min(35, baseWidth / sizeRatio));
  }, [textSize]);

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
      maxWidth={maxWidth}
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
