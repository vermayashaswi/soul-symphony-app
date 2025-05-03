
import React, { useMemo } from 'react';
import ThreeDimensionalText from './ThreeDimensionalText';

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
  // Round to nearest integer and format
  const formattedPercentage = useMemo(() => {
    const rounded = Math.round(percentage);
    return `${rounded}%`;
  }, [percentage]);

  // Skip rendering if not visible or percentage is 0
  if (!isVisible || percentage <= 0) {
    return null;
  }

  // Position above the node - slightly higher than before
  // Add extra height for better separation from the node
  const labelPosition: [number, number, number] = [0, offsetY + 0.15, 0];

  // Increased font size slightly for better visibility of percentages
  const fontSize = 0.29;

  return (
    <ThreeDimensionalText
      text={formattedPercentage}
      position={labelPosition}
      color={nodeType === 'entity' ? '#ffffff' : '#42a5f5'}
      size={fontSize}
      bold={true}
      visible={isVisible}
    />
  );
};

export default ConnectionPercentage;
