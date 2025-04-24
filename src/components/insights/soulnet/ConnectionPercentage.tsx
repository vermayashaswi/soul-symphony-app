
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
  offsetY = 0.3 // Reduced further from 0.4 to 0.3 to bring it even closer to the node
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
          backgroundColor: 'rgba(0,0,0,0.7)', // Slightly darker background for better contrast
          color: '#ffffff',
          padding: '6px 12px', // Increased padding for larger text
          borderRadius: '8px', // Increased border radius for better look with larger size
          fontSize: '120px', // Increased from 24px to 120px (10x base size of 12px)
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translateZ(0)',
          WebkitPerspective: '1000',
          transform: 'scale(0.2)', // Scale down the HTML element while keeping text crisp
          transformOrigin: 'center center',
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
