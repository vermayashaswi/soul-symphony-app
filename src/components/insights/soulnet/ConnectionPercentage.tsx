
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
  offsetY = 2.2
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
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
