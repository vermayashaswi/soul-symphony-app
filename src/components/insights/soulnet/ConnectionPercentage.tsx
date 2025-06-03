
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
  console.log(`[ConnectionPercentage] Enhanced percentage display: ${percentage}% at`, position, 'visible:', isVisible);

  // Round to nearest integer and format
  const formattedPercentage = useMemo(() => {
    const rounded = Math.round(Math.max(0, Math.min(100, percentage)));
    return `${rounded}%`;
  }, [percentage]);

  // Skip rendering if not visible or percentage is 0
  if (!isVisible || percentage <= 0) {
    console.log(`[ConnectionPercentage] Not rendering: visible=${isVisible}, percentage=${percentage}`);
    return null;
  }

  // Position in front of the node with enhanced Z offset
  const labelPosition: [number, number, number] = [
    position[0],
    position[1],
    position[2] + 3.0 // Further increased Z offset for maximum visibility
  ];

  console.log(`[ConnectionPercentage] Enhanced final render: "${formattedPercentage}" at`, labelPosition);

  return (
    <ReliableText
      text={formattedPercentage}
      position={labelPosition}
      color="#ffffff"
      size={0.4} // Slightly larger size
      visible={true}
      renderOrder={25} // Even higher render order
      bold={true}
      outlineWidth={0.08} // Maximum outline for visibility
      outlineColor="#000000"
      maxWidth={10}
    />
  );
};

export default ConnectionPercentage;
