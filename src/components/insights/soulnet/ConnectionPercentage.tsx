
import React from 'react';
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
  offsetY = 0,
  nodeType = 'emotion'
}) => {
  console.log(`ConnectionPercentage: isVisible=${isVisible}, percentage=${percentage}, nodeType=${nodeType}`);
  
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  // Position percentage label significantly higher than the node label
  // Entity nodes are larger so they need more vertical spacing
  const verticalOffset = nodeType === 'entity' ? 2.2 : 1.8;
  const textPosition: [number, number, number] = [0, verticalOffset, 0];
  
  return (
    <ThreeDimensionalText
      text={`${displayPercentage}%`}
      position={textPosition}
      color="#ffffff"
      size={0.17}
      bold={true}
      backgroundColor="#000000"
      visible={isVisible}
    />
  );
};

export default ConnectionPercentage;
