
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

  // Position in front of the node with proper Z offset
  const labelPosition: [number, number, number] = [
    position[0],
    position[1],
    position[2] + 2.5 // Increased Z offset for better visibility
  ];

  console.log(`[ConnectionPercentage] Final enhanced render: "${formattedPercentage}" at`, labelPosition);

  return (
    <ReliableText
      text={formattedPercentage}
      position={labelPosition}
      color="#ffffff"
      size={0.35}
      visible={true}
      renderOrder={20} // Higher than node labels
      bold={true}
      outlineWidth={0.06} // Increased outline for better visibility
      outlineColor="#000000"
      maxWidth={10}
    />
  );
};

export default ConnectionPercentage;
