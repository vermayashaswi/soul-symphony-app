
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
  offsetY = -0.2 // Position it right on top of the node with slight negative offset
}) => {
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  return (
    <Html
      position={[0, offsetY, 0]}
      center
      distanceFactor={10} // Reduce the distanceFactor to keep it more stable at various zoom levels
      occlude={false}
      className="z-50"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        textShadow: '0 0 10px rgba(0,0,0,1)', // Stronger text shadow for better visibility
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.85)', // Darker background for better contrast
          color: '#ffffff',
          padding: '8px 16px', // Increased padding
          borderRadius: '12px', // Larger border radius
          fontSize: '200px', // Much larger font size
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translateZ(0)',
          WebkitPerspective: '1000',
          transform: 'scale(0.15)', // Scale down to fit, but still much larger than before
          transformOrigin: 'center center',
          border: '3px solid white', // Add a white border for better visibility
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
