
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
  offsetY = 0.4 // Reduced from 2.2 to bring closer to node
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
          backgroundColor: 'rgba(0,0,0,0.6)', // Slightly darkened background
          color: '#ffffff',
          padding: '4px 8px', // Increased padding
          borderRadius: '6px',
          fontSize: '24px', // Increased from 12px
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)', // Added subtle shadow for better visibility
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
