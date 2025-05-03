
import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Color } from 'three';

interface ConnectionLineProps {
  start: [number, number, number];
  end: [number, number, number];
  isHighlighted: boolean;
  strength: number;
  isHidden?: boolean;
  sourceType: 'entity' | 'emotion';
  targetType: 'entity' | 'emotion';
  themeHex: string;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  start,
  end,
  isHighlighted,
  strength,
  isHidden = false,
  sourceType,
  targetType,
  themeHex
}) => {
  // Don't render if hidden
  if (isHidden) return null;

  // Calculate color based on connection type and state
  const lineColor = useMemo(() => {
    // Get color based on node types
    let baseColor: string;
    
    // Entity-to-Entity connections
    if (sourceType === 'entity' && targetType === 'entity') {
      baseColor = '#ffffff';
    } 
    // Entity-to-Emotion or Emotion-to-Entity connections
    else if (sourceType === 'entity' || targetType === 'entity') {
      baseColor = isHighlighted ? '#ffffff' : themeHex;
    } 
    // Emotion-to-Emotion connections
    else {
      baseColor = themeHex;
    }
    
    return baseColor;
  }, [sourceType, targetType, isHighlighted, themeHex]);
  
  // Determine line width based on connection strength and highlighted state
  const lineWidth = useMemo(() => {
    const baseWidth = Math.max(0.5, strength * 5);
    return isHighlighted ? baseWidth * 1.5 : baseWidth;
  }, [strength, isHighlighted]);

  // Determine opacity based on highlighted state
  const opacity = useMemo(() => {
    return isHighlighted ? Math.min(0.9, 0.6 + strength * 0.3) : 0.3 + strength * 0.15;
  }, [isHighlighted, strength]);

  return (
    <Line
      points={[start, end]}
      color={lineColor}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      dashed={false}
    />
  );
};

export default ConnectionLine;
