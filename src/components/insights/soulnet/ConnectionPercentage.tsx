
import React from 'react';
import { Html } from '@react-three/drei';

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
  offsetY = 0, // Default positioning
  nodeType = 'emotion' // Add node type to adjust positioning
}) => {
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  // Adjust vertical offset based on node type
  const verticalOffset = nodeType === 'entity' ? 0.5 : 0.2;
  
  return (
    <Html
      position={[0, verticalOffset + offsetY, 0]}
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
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#ffffff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '600px', // Increased to 10x (previously 60px)
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          transform: 'scale(0.05)', // Further scaled down to maintain proportions
          transformOrigin: 'center center',
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
