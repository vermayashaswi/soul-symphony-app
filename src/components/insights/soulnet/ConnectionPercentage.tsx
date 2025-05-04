
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

  // Position above the node - increased distance from 2.6 to 3.5 for emotion nodes
  // For entity (circular) nodes, use 4.1 units as requested
  const labelPosition: [number, number, number] = [
    0, 
    offsetY + (nodeType === 'entity' ? 4.1 : 3.5), 
    0
  ];

  // Adjust font size for percentages - decreased by 30%
  const fontSize = 0.2625; // Original 0.375 * 0.7 = 0.2625 (30% decrease)

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
