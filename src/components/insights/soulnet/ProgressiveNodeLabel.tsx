
import React, { useMemo } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
  cameraZoom,
  themeHex,
  nodeScale = 1
}) => {
  console.log(`[ProgressiveNodeLabel] Rendering label for ${id}, visible: ${shouldShowLabel}`);

  // Calculate label position offset with safety checks
  const calculateOffset = (): [number, number, number] => {
    try {
      const baseOffset = type === 'entity' ? 1.8 : 2.2;
      const scaledOffset = baseOffset * Math.max(0.5, Math.min(2, nodeScale || 1));
      return [0, scaledOffset, 0];
    } catch (error) {
      console.warn('[ProgressiveNodeLabel] Offset calculation error:', error);
      return [0, 2, 0];
    }
  };

  // Calculate text properties with safety checks
  const textSize = useMemo(() => {
    try {
      const zoom = cameraZoom || 45;
      const baseSize = 0.4;
      const zoomFactor = Math.max(0.7, Math.min(1.3, (50 - zoom) * 0.02 + 1));
      return Math.max(0.2, Math.min(0.8, baseSize * zoomFactor));
    } catch (error) {
      console.warn('[ProgressiveNodeLabel] Text size calculation error:', error);
      return 0.4;
    }
  }, [cameraZoom]);

  const textColor = useMemo(() => {
    try {
      if (isSelected) return '#ffffff';
      if (isHighlighted) return type === 'entity' ? '#ffffff' : themeHex;
      return '#cccccc';
    } catch (error) {
      console.warn('[ProgressiveNodeLabel] Text color calculation error:', error);
      return '#ffffff';
    }
  }, [isSelected, isHighlighted, type, themeHex]);

  // Don't render if not visible
  if (!shouldShowLabel) {
    console.log(`[ProgressiveNodeLabel] Not rendering: visible=${shouldShowLabel}`);
    return null;
  }

  const labelOffset = calculateOffset();
  const labelPosition: [number, number, number] = [
    position[0] + labelOffset[0],
    position[1] + labelOffset[1], 
    position[2] + labelOffset[2]
  ];

  console.log(`[ProgressiveNodeLabel] Rendering TranslatableText for ${id} at`, labelPosition);

  return (
    <group position={labelPosition}>
      <TranslatableText
        text={id}
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
          textOverflow: 'ellipsis'
        }}
      />
    </group>
  );
};

export default ProgressiveNodeLabel;
