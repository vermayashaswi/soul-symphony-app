
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

  // SOLUTION 9: Enhanced positioning for percentage display
  const labelPosition: [number, number, number] = [
    position[0] + 0.5, // Slightly offset to right for better visibility
    position[1] + offsetY + 0.5, // Above the node with proper offset
    position[2] + 0.1 // Small Z offset to prevent z-fighting
  ];

  console.log(`[ConnectionPercentage] Enhanced final render: "${formattedPercentage}" at`, labelPosition);

  return (
    <ReliableText
      text={formattedPercentage}
      position={labelPosition}
      color="#60a5fa" // Bright blue color for better visibility
      size={0.5} // Larger size for better readability
      visible={true}
      renderOrder={30} // Higher render order than labels
      bold={true}
      outlineWidth={0.1} // Thick outline for maximum contrast
      outlineColor="#000000"
      maxWidth={8}
    />
  );
};

export default ConnectionPercentage;
