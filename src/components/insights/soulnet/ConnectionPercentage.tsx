
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

  // Position above the node - adjusted for larger font size
  // Add extra height for Hindi/non-Latin script compatibility
  const labelPosition: [number, number, number] = [0, offsetY + 1.0, 0]; // Increased from offsetY + 0.2

  // Stable font size for percentages - using a slightly smaller size since they're numeric
  const fontSize = 0.25; // Will be doubled automatically in ThreeDimensionalText

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
