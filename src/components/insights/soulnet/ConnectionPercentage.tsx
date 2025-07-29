
import React, { useMemo } from 'react';
import ReliableText from './ReliableText';

interface ConnectionPercentageProps {
  position: [number, number, number];
  percentage: number;
  isVisible: boolean;
  offsetY?: number;
  nodeType?: 'entity' | 'emotion';
}

export const ConnectionPercentage: React.FC<ConnectionPercentageProps> = ({
  position,
  percentage,
  isVisible,
  offsetY = 1.0,
  nodeType = 'emotion'
}) => {
  console.log(`[ConnectionPercentage] ENHANCED: Displaying ${percentage}% for ${nodeType} node at`, position);

  // Round to nearest integer and format
  const formattedPercentage = useMemo(() => {
    const rounded = Math.round(Math.max(0, Math.min(100, percentage)));
    return `${rounded}%`;
  }, [percentage]);

  // Skip rendering if not visible or percentage is 0
  if (!isVisible || percentage <= 0) {
    console.log(`[ConnectionPercentage] ENHANCED: Not rendering - visible=${isVisible}, percentage=${percentage}`);
    return null;
  }

  // ENHANCED: Better positioning based on node type and size
  const labelPosition: [number, number, number] = useMemo(() => {
    const baseOffset = nodeType === 'entity' ? 1.8 : 1.5; // Entities (spheres) are slightly larger
    return [
      position[0] + baseOffset, // Position to the right to avoid overlap
      position[1] + offsetY, // Slight upward offset
      position[2] + 2.0 // Forward offset for visibility
    ];
  }, [position, offsetY, nodeType]);

  console.log(`[ConnectionPercentage] ENHANCED: Rendering "${formattedPercentage}" at`, labelPosition, 'for', nodeType);

  return (
    <ReliableText
      text={formattedPercentage}
      position={labelPosition}
      color="#ffffff"
      size={0.45} // Slightly larger for better readability
      visible={true}
      renderOrder={30} // Highest render order to appear on top
      bold={true}
      outlineWidth={0.1} // Strong outline for visibility
      outlineColor="#000000"
      maxWidth={8}
    />
  );
};

export default ConnectionPercentage;
