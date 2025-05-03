
import React, { useMemo } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  translatedText?: string;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  translatedText
}) => {
  console.log(`NodeLabel for "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}, type=${type}`);

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Increased the base size by 2.5x (from 0.15 to 0.375)
    // Also adjusted the maximum and minimum values accordingly
    const base = 0.375 + Math.max(0, (26 - z) * 0.0125);
    return Math.max(Math.min(base, 0.55), 0.325);
  }, [cameraZoom]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  // Keep node labels at a consistent position, lower than percentage labels
  // Use different vertical positions for entity vs emotion nodes
  const verticalPosition = type === 'entity' ? 0.9 : 0.8;
  const labelPosition: [number, number, number] = [0, verticalPosition, 0];

  return (
    <ThreeDimensionalText
      text={translatedText || id}
      position={labelPosition}
      color={type === 'entity' ? '#ffffff' : themeHex}
      size={dynamicFontSize}
      bold={isHighlighted}
      visible={shouldShowLabel}
    />
  );
};

export default NodeLabel;
