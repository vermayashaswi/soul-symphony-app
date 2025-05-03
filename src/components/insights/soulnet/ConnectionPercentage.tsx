
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
  
  // Position label above the node to avoid overlapping
  const verticalOffset = nodeType === 'entity' ? 1.5 : 1.2;
  
  return (
    <Html
      position={[0, verticalOffset, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-[9999]"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        textShadow: '0 0 4px rgba(0,0,0,0.8)',
        transform: 'translateZ(9999px)',
        fontSize: '18px',
        fontWeight: 'bold',
        width: 'auto',
        height: 'auto',
      }}
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
          transformOrigin: 'center center',
          lineHeight: '1.2',
          opacity: 1,
          zIndex: 9999,
          position: 'relative',
        }}
      >
        <TranslatableText 
          text={`${displayPercentage}%`} 
          forceTranslate={true} 
          style={{
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            color: '#fff',
            fontWeight: 'bold',
          }}
        />
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
