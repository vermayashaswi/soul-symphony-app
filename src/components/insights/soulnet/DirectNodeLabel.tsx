
import React, { useMemo } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
      const baseSize = 0.4;
      const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
      return Math.max(0.2, Math.min(0.8, baseSize * zoomFactor));
    } catch (error) {
      console.warn('[DirectNodeLabel] Error calculating text size:', error);
      return 0.4;
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

  console.log(`[DirectNodeLabel] Rendering TranslatableText for "${id}" at position`, labelPosition);

  try {
    return (
      <group position={labelPosition}>
        <TranslatableText
          text={id || 'Unknown'}
          as="div"
          forceTranslate={true}
          style={{
            color: textColor,
            fontSize: `${textSize}rem`,
            fontWeight: (isHighlighted || isSelected) ? 'bold' : 'normal',
            textAlign: 'center',
            textShadow: isSelected 
              ? '2px 2px 4px #000000' 
              : '1px 1px 2px #333333',
            maxWidth: '25ch',
            wordWrap: 'break-word',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none'
          }}
        />
      </group>
    );
  } catch (error) {
    console.error('[DirectNodeLabel] Error rendering label:', error);
    return null;
  }
};

export default DirectNodeLabel;
