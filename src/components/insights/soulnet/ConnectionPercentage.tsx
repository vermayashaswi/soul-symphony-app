
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
  console.log(`ConnectionPercentage: isVisible=${isVisible}, percentage=${percentage}, nodeType=${nodeType}`);
  
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  // Position percentage label significantly higher than the node label
  // Entity nodes are larger so they need more vertical spacing
  const verticalOffset = nodeType === 'entity' ? 2.2 : 1.8;
  
  // We're simplifying this component to use TranslatableText directly
  return (
    <Html
      position={[0, verticalOffset, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-[9999]"
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#ffffff',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
          transform: 'scale(1)',
          lineHeight: '1.2',
          opacity: 1,
          position: 'relative',
          zIndex: 9999,
          pointerEvents: 'none',
          userSelect: 'none',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)'
        }}
      >
        {`${displayPercentage}%`}
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
