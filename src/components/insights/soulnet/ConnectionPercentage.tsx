
import React from 'react';
import { Html } from '@react-three/drei';

interface ConnectionPercentageProps {
  position: [number, number, number];
  percentage: number;
  isVisible: boolean;
  offsetY?: number;
}

export const ConnectionPercentage: React.FC<ConnectionPercentageProps> = ({
  position,
  percentage,
  isVisible,
  offsetY = 0.4 // Reduced from 2.2 to 0.4 to bring it closer to the node
}) => {
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  return (
    <Html
      position={[0, offsetY, 0]}
      center
      distanceFactor={1}
      occlude={false}
      className="z-50"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        textShadow: '0 0 5px rgba(0,0,0,0.8)',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: '#ffffff',
          padding: '4px 8px', // Increased padding
          borderRadius: '4px',
          fontSize: '24px', // Increased from 12px to 24px (2x base size)
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translateZ(0)',
          WebkitPerspective: '1000',
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;

