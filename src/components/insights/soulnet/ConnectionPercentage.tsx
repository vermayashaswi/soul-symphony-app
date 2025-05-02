
import React from 'react';
import { Html } from '@react-three/drei';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  // Position label much higher to avoid overlapping with node labels
  const verticalOffset = nodeType === 'entity' ? 2.5 : 2.2;
  
  return (
    <Html
      position={[0, verticalOffset, 0]}
      center
      distanceFactor={1}
      occlude={false}
      className="z-50"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        textShadow: '0 0 10px rgba(0,0,0,0.8)',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '12px',
          fontSize: '200px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
          transform: 'scale(1)',
          transformOrigin: 'center center',
          lineHeight: '1',
        }}
      >
        <TranslatableText 
          text={`${displayPercentage}%`} 
          forceTranslate={true} 
        />
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
