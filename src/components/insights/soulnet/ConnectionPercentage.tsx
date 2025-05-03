
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
  // Increase vertical offset for better spacing between labels
  const verticalOffset = nodeType === 'entity' ? 2.0 : 1.6;
  
  return (
    <Html
      position={[0, verticalOffset, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-[99999]" // Extremely high z-index for overlay
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        textShadow: '0 0 5px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.8)', // Stronger text shadow
        transform: 'translateZ(9999px)', // Force to front
        willChange: 'transform', // Performance optimization
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.9)', // Even darker background for better contrast
          color: '#ffffff',
          padding: '5px 10px', // Increased padding for better visibility
          borderRadius: '6px',
          fontSize: '20px', // Larger font size
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 3px 6px rgba(0,0,0,0.7)', // Stronger shadow
          transform: 'scale(0.9)',
          transformOrigin: 'center center',
          lineHeight: '1',
          opacity: 1, // Full opacity for better visibility
          textShadow: '0 2px 4px rgba(0,0,0,0.9)', // Stronger text shadow
          border: '1px solid rgba(255,255,255,0.3)', // More visible border
          minWidth: '40px', // Ensure minimum width for small percentages
          textAlign: 'center',
          letterSpacing: '0.5px', // Better readability
        }}
      >
        <TranslatableText 
          text={`${displayPercentage}%`} 
          forceTranslate={true}
          style={{ fontWeight: 'bold', fontSize: '20px' }}
        />
      </div>
      
      {/* Add a DOM fallback for browsers where Three.js HTML might fail */}
      <div id={`percentage-fallback-${displayPercentage}`} 
        className="hidden fixed top-0 left-0 px-2 py-1 bg-black text-white rounded text-sm font-bold z-[100000]"
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 100000,
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;
