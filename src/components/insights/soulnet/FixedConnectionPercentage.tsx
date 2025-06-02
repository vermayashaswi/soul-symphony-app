
import React, { useMemo } from 'react';
import ReliableText from './ReliableText';

interface FixedConnectionPercentageProps {
  position: [number, number, number];
  percentage: number;
  isVisible: boolean;
  nodeType?: 'entity' | 'emotion';
}

export const FixedConnectionPercentage: React.FC<FixedConnectionPercentageProps> = ({
  position,
  percentage,
  isVisible,
  nodeType = 'emotion'
}) => {
  console.log(`[FixedConnectionPercentage] Rendering ${percentage}% at`, position, 'visible:', isVisible, 'nodeType:', nodeType);

  // Format percentage with validation
  const formattedPercentage = useMemo(() => {
    const validPercentage = Math.round(Math.max(0, Math.min(100, percentage || 0)));
    return `${validPercentage}%`;
  }, [percentage]);

  // Enhanced visibility check
  if (!isVisible || !percentage || percentage <= 0) {
    console.log(`[FixedConnectionPercentage] Not rendering: visible=${isVisible}, percentage=${percentage}`);
    return null;
  }

  // Simplified positioning with better Z offset - much closer to camera
  const percentagePosition: [number, number, number] = useMemo(() => {
    const yOffset = nodeType === 'entity' ? 1.2 : 1.0; // Position above node
    const zOffset = 1.5; // Much closer Z offset for better visibility
    return [
      position[0],
      position[1] + yOffset,
      position[2] + zOffset
    ];
  }, [position, nodeType]);

  console.log(`[FixedConnectionPercentage] Final render: "${formattedPercentage}" at`, percentagePosition, 'for nodeType:', nodeType);

  return (
    <ReliableText
      text={formattedPercentage}
      position={percentagePosition}
      color="#ffff00" // Bright yellow for better visibility
      size={0.6} // Larger size for better visibility
      visible={true}
      renderOrder={50} // Very high render order to ensure it's on top
      bold={true}
      outlineWidth={0.12} // Thicker outline for better contrast
      outlineColor="#000000"
      maxWidth={15}
    />
  );
};

export default FixedConnectionPercentage;
