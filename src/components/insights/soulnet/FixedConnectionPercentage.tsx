
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

  // Dynamic positioning based on node type with better Z offset
  const percentagePosition: [number, number, number] = useMemo(() => {
    const baseOffset = nodeType === 'entity' ? 3.0 : 2.8; // Slightly different offsets for different node types
    return [
      position[0],
      position[1] + 0.5, // Slight Y offset to position above node
      position[2] + baseOffset // Enhanced Z offset for better visibility
    ];
  }, [position, nodeType]);

  console.log(`[FixedConnectionPercentage] Final render: "${formattedPercentage}" at`, percentagePosition, 'for nodeType:', nodeType);

  return (
    <ReliableText
      text={formattedPercentage}
      position={percentagePosition}
      color="#ffffff"
      size={0.4} // Slightly larger for better visibility
      visible={true}
      renderOrder={25} // Higher render order than labels
      bold={true}
      outlineWidth={0.08} // Enhanced outline for better contrast
      outlineColor="#000000"
      maxWidth={10}
    />
  );
};

export default FixedConnectionPercentage;
