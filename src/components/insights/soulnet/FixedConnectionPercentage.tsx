
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
  console.log(`[FixedConnectionPercentage] Rendering ${percentage}% at`, position, 'visible:', isVisible);

  // Format percentage
  const formattedPercentage = useMemo(() => {
    const rounded = Math.round(Math.max(0, Math.min(100, percentage)));
    return `${rounded}%`;
  }, [percentage]);

  // Don't render if not visible or percentage is 0
  if (!isVisible || percentage <= 0) {
    console.log(`[FixedConnectionPercentage] Not rendering: visible=${isVisible}, percentage=${percentage}`);
    return null;
  }

  // Position the percentage in front of the node
  const percentagePosition: [number, number, number] = [
    position[0],
    position[1],
    position[2] + 2.0 // Move forward in Z to ensure visibility
  ];

  console.log(`[FixedConnectionPercentage] Final render: "${formattedPercentage}" at`, percentagePosition);

  return (
    <ReliableText
      text={formattedPercentage}
      position={percentagePosition}
      color="#ffffff"
      size={0.35}
      visible={true}
      renderOrder={20} // Higher than labels
      bold={true}
      outlineWidth={0.05}
      outlineColor="#000000"
      maxWidth={10}
    />
  );
};

export default FixedConnectionPercentage;
