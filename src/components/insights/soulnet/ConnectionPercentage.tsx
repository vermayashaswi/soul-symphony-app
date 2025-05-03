
import React, { useEffect } from 'react';
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
  // Extended debug logging for understanding visibility issues
  useEffect(() => {
    console.log(`ConnectionPercentage MOUNT: isVisible=${isVisible}, percentage=${percentage}, nodeType=${nodeType}, pathname=${window.location.pathname}`);
    return () => {
      console.log(`ConnectionPercentage UNMOUNT: isVisible=${isVisible}, percentage=${percentage}`);
    };
  }, [isVisible, percentage, nodeType]);
  
  // Debug logging for understanding visibility issues
  console.log(`ConnectionPercentage RENDER: isVisible=${isVisible}, percentage=${percentage}, nodeType=${nodeType}, path=${window.location.pathname}`);
  
  // Don't render if not visible or percentage is zero/negative
  if (!isVisible || percentage <= 0) return null;

  const displayPercentage = Math.round(percentage);
  
  // Position label above the node to avoid overlapping
  const verticalOffset = nodeType === 'entity' ? 1.5 : 1.2;
  
  return (
    <Html
      position={[0, verticalOffset, 0]}
      center
      distanceFactor={15}
      occlude={false}
      zIndexRange={[99990, 100000]} // Set extremely high z-index range
      className="z-50"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        textShadow: '0 0 3px rgba(0,0,0,0.5)',
        willChange: 'transform', // Optimize for transforms
        backfaceVisibility: 'hidden', // Prevent flickering
        transformStyle: 'preserve-3d', // Ensure 3D positioning
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.9)', // Even darker background for better contrast
          color: '#ffffff',
          padding: '4px 8px', // Increased padding for better visibility
          borderRadius: '4px',
          fontSize: '20px', // Bigger font size for better visibility
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.8)', // More prominent shadow
          transform: 'scale(0.9)',
          transformOrigin: 'center center',
          lineHeight: '1',
          opacity: 1, // Full opacity for better visibility
          textShadow: '0 1px 2px rgba(0,0,0,0.9)', // Text shadow for better readability
          border: '1px solid rgba(255,255,255,0.3)', // Better visible border
        }}
      >
        {/* CRITICAL FIX: Always force translate the percentage */}
        <TranslatableText 
          text={`${displayPercentage}%`} 
          forceTranslate={true}
          style={{ fontWeight: 'bold' }}
        />
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
