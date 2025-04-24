
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';

interface ConnectionPercentageProps {
  position: [number, number, number];
  percentage: number;
  isVisible: boolean;
  offsetY?: number;
  nodeType?: 'entity' | 'emotion';
  cameraZoom?: number;
}

export const ConnectionPercentage: React.FC<ConnectionPercentageProps> = ({
  position,
  percentage,
  isVisible,
  offsetY = 0,
  nodeType = 'emotion',
  cameraZoom
}) => {
  if (!isVisible) return null;

  const displayPercentage = Math.round(percentage);
  
  // Position label directly on top of the node based on its type
  const verticalOffset = nodeType === 'entity' ? 0.8 : 0.6;

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Use same base calculation as NodeLabel but scaled to 75%
    const base = (12.825 + Math.max(0, (z - 18) * 0.8)) * 10;
    const scaledSize = (Math.round(Math.max(Math.min(base, 324), 118.8) * 100) / 100) * 0.75;
    return scaledSize;
  }, [cameraZoom]);
  
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
        textShadow: '0 0 5px rgba(0,0,0,0.8)',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#ffffff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: `${dynamicFontSize}px`,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          transform: 'scale(1)',
          transformOrigin: 'center center',
        }}
      >
        {displayPercentage}%
      </div>
    </Html>
  );
};

export default ConnectionPercentage;

