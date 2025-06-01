
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

  // Position in front of the node, not at the center
  // Move the label forward in the z direction to ensure it's visible
  const labelPosition: [number, number, number] = [0, 0, 1.5]; // Z offset of 1.5 to place in front

  // Increase font size slightly for better visibility
  const fontSize = 0.3; // Increased from 0.2625 for better visibility

  // Use bright white text for maximum contrast against any background
  const textColor = '#ffffff';

  return (
    <ThreeDimensionalText
      text={formattedPercentage}
      position={labelPosition}
      color={textColor}
      size={fontSize}
      bold={true}
      visible={isVisible}
      opacity={1.0} // Full opacity for maximum visibility
      skipTranslation={true} // Always skip translation for percentage values
      outlineWidth={0.04} // Increased outline width for better visibility
      outlineColor="#000000" // Black outline for contrast
      renderOrder={10} // Higher render order to ensure it renders on top
    />
  );
};

export default ConnectionPercentage;
