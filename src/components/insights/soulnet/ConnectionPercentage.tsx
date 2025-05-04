
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

  // Position above the node - adjusted for larger font size and node size
  // Add extra height for the increased node sizes
  const labelPosition: [number, number, number] = [0, offsetY + 1.5, 0]; // Increased from offsetY + 1.0

  // Double the font size for percentages and account for automatic doubling in ThreeDimensionalText
  const fontSize = 0.5; // Doubled from 0.25

  return (
    <ThreeDimensionalText
      text={formattedPercentage}
      position={labelPosition}
      color={nodeType === 'entity' ? '#ffffff' : '#42a5f5'}
      size={fontSize}
      bold={true}
      visible={isVisible}
      opacity={0.95} // Slightly higher opacity for better readability
      skipTranslation={true} // Always skip translation for percentage values
    />
  );
};

export default ConnectionPercentage;
