
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TranslatableHtmlText } from './TranslatableHtmlText';

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
  console.log(`[DirectNodeLabel] Rendering label for ${id}, visible: ${shouldShowLabel}`);

  // Don't render if not visible - early return for performance
  if (!shouldShowLabel) {
    return null;
  }

  // Calculate position offset with proper error handling
  const labelOffset = useMemo(() => {
    try {
      const baseOffset = type === 'entity' ? 1.8 : 2.2;
      const safeNodeScale = Math.max(0.5, Math.min(2, nodeScale || 1));
      const scaledOffset = baseOffset * safeNodeScale;
      return [0, scaledOffset, 0] as [number, number, number];
    } catch (error) {
      console.warn('[DirectNodeLabel] Error calculating offset:', error);
      return [0, 2, 0] as [number, number, number];
    }
  }, [type, nodeScale]);

  // Calculate text properties with safety checks
  const textSize = useMemo(() => {
    try {
      const zoom = Math.max(10, Math.min(100, cameraZoom || 45));
      const baseSize = 12;
      const zoomFactor = Math.max(0.8, Math.min(1.4, (60 - zoom) * 0.02 + 1));
      return Math.max(10, Math.min(18, baseSize * zoomFactor));
    } catch (error) {
      console.warn('[DirectNodeLabel] Error calculating text size:', error);
      return 12;
    }
  }, [cameraZoom]);

  const textColor = useMemo(() => {
    try {
      if (isSelected) return '#ffffff';
      if (isHighlighted) return type === 'entity' ? '#ffffff' : (themeHex || '#3b82f6');
      return '#cccccc';
    } catch (error) {
      console.warn('[DirectNodeLabel] Error calculating text color:', error);
      return '#ffffff';
    }
  }, [isSelected, isHighlighted, type, themeHex]);

  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1],
    position[2] + labelOffset[2]
  ];

  console.log(`[DirectNodeLabel] Rendering Html component for "${id}" at position`, labelPosition);

  try {
    return (
      <group position={labelPosition}>
        <Html
          center
          distanceFactor={15}
          transform
          sprite
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <TranslatableHtmlText
            text={id}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            nodeType={type}
            style={{
              fontSize: `${textSize}px`,
              color: textColor,
              background: isSelected ? 'rgba(0,0,0,0.3)' : 'transparent',
              padding: isSelected ? '2px 6px' : '0',
              borderRadius: isSelected ? '4px' : '0',
              backdropFilter: isSelected ? 'blur(2px)' : 'none'
            }}
          />
        </Html>
      </group>
    );
  } catch (error) {
    console.error('[DirectNodeLabel] Error rendering Html label:', error);
    return null;
  }
};

export default DirectNodeLabel;
