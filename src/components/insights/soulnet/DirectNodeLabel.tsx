
import React, { useMemo } from 'react';
import SmartTextRenderer from './SmartTextRenderer';

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
  translatedText?: string;
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
  
  // Add connection percentage to display text when selected and showPercentage is true
  const finalDisplayText = useMemo(() => {
    if (isSelected && showPercentage && connectionPercentage > 0) {
      return `${displayText}\n${connectionPercentage}%`;
    }
    return displayText;
  }, [displayText, isSelected, showPercentage, connectionPercentage]);

  // Calculate position offset - adjust for different node types
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.8 : 2.5; // Increased offset for cube emotion nodes
    const scaledOffset = baseOffset * Math.max(0.5, Math.min(2, nodeScale));
    return [0, scaledOffset, 0] as [number, number, number];
  }, [type, nodeScale]);

  // Calculate text properties - 10x larger base size
  const textSize = useMemo(() => {
    const zoom = Math.max(10, Math.min(100, cameraZoom));
    const baseSize = 4.0; // Increased from 0.4 to 4.0 (10x larger)
    const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
    return Math.max(2.0, Math.min(8.0, baseSize * zoomFactor)); // Adjusted min/max accordingly
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

  if (!shouldShowLabel || !finalDisplayText) {
    return null;
  }

  console.log(`[DirectNodeLabel] Rendering text "${finalDisplayText}" at position`, labelPosition, 'with size:', textSize);

  return (
    <SmartTextRenderer
      text={finalDisplayText}
      position={labelPosition}
      color={textColor}
      size={textSize}
      visible={true}
      renderOrder={15}
      bold={isHighlighted || isSelected}
      outlineWidth={isSelected ? 0.4 : 0.2} // Scaled outline width for larger text
      outlineColor={isSelected ? '#000000' : '#333333'}
      maxWidth={250} // Increased max width for larger text
    />
  );
};

export default DirectNodeLabel;
