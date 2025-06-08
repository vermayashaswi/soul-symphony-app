
import React, { useMemo } from 'react';
import SimpleText from './SimpleText';

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

  // Optimized positioning with better Z offset
  const percentagePosition: [number, number, number] = useMemo(() => {
    const yOffset = nodeType === 'entity' ? 1.2 : 1.0;
    const zOffset = 1.5;
    return [
      position[0],
      position[1] + yOffset,
      position[2] + zOffset
    ];
  }, [position, nodeType]);

  console.log(`[FixedConnectionPercentage] Final render: "${formattedPercentage}" at`, percentagePosition, 'for nodeType:', nodeType);

  return (
    <SimpleText
      text={formattedPercentage}
      position={percentagePosition}
      color="#ffff00"
      size={0.6}
      visible={true}
      renderOrder={50}
      bold={true}
      outlineWidth={0.12}
      outlineColor="#000000"
      maxWidth={15}
    />
  );
};

export default FixedConnectionPercentage;
