
import React, { useMemo } from 'react';
import SimpleText from './SimpleText';

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
  connectionPercentage?: number;
  showPercentage?: boolean;
  translatedText?: string; // New prop for translated text
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
  nodeScale = 1,
  connectionPercentage = 0,
  showPercentage = false,
  translatedText
}) => {
  console.log(`[DirectNodeLabel] Rendering with translated text for ${id}: "${translatedText || id}"`);

  // Use translated text if available, otherwise fallback to original id
  const displayText = translatedText || id;

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

  if (!shouldShowLabel || !displayText) {
    return null;
  }

  console.log(`[DirectNodeLabel] Rendering text "${displayText}" at position`, labelPosition);

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

export default DirectNodeLabel;
