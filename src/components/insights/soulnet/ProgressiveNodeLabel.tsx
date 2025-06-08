
import React, { useState, useEffect, useMemo } from 'react';
import SimpleText from './SimpleText';
import { useTranslation } from '@/contexts/TranslationContext';

interface ProgressiveNodeLabelProps {
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

export const ProgressiveNodeLabel: React.FC<ProgressiveNodeLabelProps> = ({
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
  const [isTranslationReady, setIsTranslationReady] = useState<boolean>(false);

  console.log(`[ProgressiveNodeLabel] Rendering for ${id}, visible: ${shouldShowLabel}`);

  // Handle translation using GoogleWebTranslate approach
  useEffect(() => {
    const translateText = async () => {
      if (!shouldShowLabel || !id) {
        setIsTranslationReady(false);
        return;
      }

      try {
        if (currentLanguage === 'en' || !translate) {
          setDisplayText(id);
          setIsTranslationReady(true);
          return;
        }

        console.log(`[ProgressiveNodeLabel] Translating "${id}" to ${currentLanguage}`);
        const translated = await translate(id);
        
        if (translated && typeof translated === 'string') {
          setDisplayText(translated);
          console.log(`[ProgressiveNodeLabel] Translation: "${id}" -> "${translated}"`);
        } else {
          setDisplayText(id);
        }
        
        setIsTranslationReady(true);
      } catch (error) {
        console.warn(`[ProgressiveNodeLabel] Translation failed for ${id}:`, error);
        setDisplayText(id);
        setIsTranslationReady(true);
      }
    };

    setIsTranslationReady(false);
    translateText();
  }, [id, currentLanguage, translate, shouldShowLabel]);

  // Calculate position offset
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.8 : 2.2;
    const scaledOffset = baseOffset * Math.max(0.5, Math.min(2, nodeScale));
    
    console.log(`[ProgressiveNodeLabel] Label offset for ${id} (${type}): ${scaledOffset} (scale: ${nodeScale})`);
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale, id]);

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

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  if (!shouldShowLabel || !displayText || !isTranslationReady) {
    return null;
  }

  console.log(`[ProgressiveNodeLabel] Final render: "${displayText}" at position`, labelPosition);

  return (
    <SimpleText
      text={displayText}
      position={labelPosition}
      color={textColor}
      size={textSize}
      visible={true}
      renderOrder={15}
      bold={isHighlighted || isSelected}
      outlineWidth={isSelected ? 0.04 : 0.02}
      outlineColor={isSelected ? '#000000' : '#333333'}
      maxWidth={25}
    />
  );
};

export default ProgressiveNodeLabel;
