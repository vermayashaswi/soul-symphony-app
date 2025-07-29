import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';

interface DirectNodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  dimmed: boolean;
  showLabel: boolean;
  cameraZoom: number;
  theme: 'light' | 'dark';
  nodeScale: number;
}

export const DirectNodeLabel: React.FC<DirectNodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  dimmed,
  showLabel,
  cameraZoom,
  theme,
  nodeScale
}) => {
  const labelOffset = useMemo(() => {
    const baseOffset = type === 'entity' ? 1.2 : 1.0;
    return baseOffset * nodeScale;
  }, [type, nodeScale]);

  const textSize = useMemo(() => {
    const baseSize = 0.3;
    const zoomFactor = Math.max(0.8, Math.min(1.5, 50 / cameraZoom));
    return baseSize * zoomFactor;
  }, [cameraZoom]);

  const textColor = useMemo(() => {
    if (dimmed) {
      return theme === 'light' ? '#9ca3af' : '#6b7280';
    }
    if (isSelected || isHighlighted) {
      return theme === 'light' ? '#1f2937' : '#f9fafb';
    }
    return theme === 'light' ? '#374151' : '#d1d5db';
  }, [dimmed, isSelected, isHighlighted, theme]);

  if (!showLabel || dimmed) {
    return null;
  }

  return (
    <Text
      position={[position[0], position[1] + labelOffset, position[2]]}
      fontSize={textSize}
      color={textColor}
      anchorX="center"
      anchorY="middle"
      maxWidth={4}
      textAlign="center"
    >
      {id}
    </Text>
  );
};

export default DirectNodeLabel;