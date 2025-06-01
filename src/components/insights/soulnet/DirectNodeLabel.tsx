
import React, { useState, useEffect, useMemo } from 'react';
import ReliableText from './ReliableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { threejsFontService } from '@/services/threejsFontService';

interface DirectNodeLabelProps {
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

export const DirectNodeLabel: React.FC<DirectNodeLabelProps> = ({
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
  const [isReady, setIsReady] = useState(false);

  console.log(`[DirectNodeLabel] Enhanced rendering label for ${id}, visible: ${shouldShowLabel}`);

  // Initialize component with enhanced font support
  useEffect(() => {
    const init = async () => {
      try {
        // Ensure font service is ready
        if (threejsFontService.isReady()) {
          setIsReady(true);
        } else {
          // Wait a bit for font service initialization
          setTimeout(() => setIsReady(true), 100);
        }
      } catch (error) {
        console.warn('[DirectNodeLabel] Font init error:', error);
        setIsReady(true); // Don't block on font errors
      }
    };

    init();
  }, []);

  // Handle translation with enhanced script support
  useEffect(() => {
    if (!isReady || !shouldShowLabel) return;

    const translateText = async () => {
      try {
        if (currentLanguage === 'en' || !translate) {
          setDisplayText(id);
          return;
        }

        const translated = await translate(id);
        if (translated && typeof translated === 'string') {
          setDisplayText(translated);
          
          // Log script detection for debugging
          const scriptType = threejsFontService.detectScriptType(translated);
          const fontName = threejsFontService.getFontNameForText(translated);
          console.log(`[DirectNodeLabel] Translation: "${id}" -> "${translated}", Script: ${scriptType}, Font: ${fontName}`);
        } else {
          setDisplayText(id);
        }
      } catch (error) {
        console.warn(`[DirectNodeLabel] Translation failed for ${id}:`, error);
        setDisplayText(id);
      }
    };

    translateText();
  }, [id, currentLanguage, translate, shouldShowLabel, isReady]);

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

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  // Don't render until ready and visible
  if (!isReady || !shouldShowLabel || !displayText) {
    return null;
  }

  console.log(`[DirectNodeLabel] Enhanced rendering text "${displayText}" at position`, labelPosition);

  return (
    <ReliableText
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

export default DirectNodeLabel;
