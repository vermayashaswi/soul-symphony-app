
import React, { useMemo, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  shouldShowLabel,
  cameraZoom,
  themeHex
}) => {
  // Extended debug logging to track node label visibility
  useEffect(() => {
    console.log(`NodeLabel MOUNT "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}, type=${type}, path=${window.location.pathname}`);
    return () => {
      console.log(`NodeLabel UNMOUNT "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}`);
    };
  }, [id, isHighlighted, shouldShowLabel, type]);

  // Debug logging each render
  console.log(`NodeLabel RENDER for "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}, type=${type}, path=${window.location.pathname}`);

  // Force larger font sizes for better visibility
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Calculate appropriate size based on camera distance
    // Lower base size for better visibility
    const base = 16 + Math.max(0, (26 - z) * 0.5);
    return Math.max(Math.min(base, 22), 14);
  }, [cameraZoom]);

  const labelStyle = useMemo(() => ({
    transform: isHighlighted ? 'scale(1.1) translateZ(9999px)' : 'scale(1) translateZ(9999px)',
    minWidth: 'auto',
    minHeight: 'auto',
    pointerEvents: 'none' as const,
    fontSize: `${dynamicFontSize}px`,
    fontWeight: isHighlighted ? 800 : 700,
    lineHeight: 1.1,
    zIndex: isHighlighted ? 100000 : 99999,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'transform 0.2s ease-out, font-weight 0.2s ease',
    willChange: 'transform',
    opacity: shouldShowLabel ? 1 : 0,
    textShadow: isHighlighted 
      ? '0 0 6px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.9)' 
      : '0 0 5px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)'
  }), [dynamicFontSize, shouldShowLabel, isHighlighted]);

  const labelTextStyle = useMemo(() => ({
    color: type === 'entity' ? '#fff' : themeHex,
    padding: '0.2rem 0.6rem',
    fontWeight: isHighlighted ? 'bold' : 'semibold',
    backgroundColor: isHighlighted ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.8)', // Even darker background for better visibility
    borderRadius: '6px',
    boxShadow: isHighlighted ? '0 2px 6px rgba(0,0,0,0.7)' : '0 1px 3px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.2)', // Subtle border for better definition
    letterSpacing: '0.5px', // Better readability
  }), [type, themeHex, isHighlighted]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  // Create a unique ID for this label
  const labelId = `node-label-${id.replace(/\s+/g, '-')}`;
  
  // Position label further above the node to avoid overlapping with percentages
  const verticalOffset = type === 'entity' ? 1.4 : 1.2;

  return (
    <Html
      position={[0, verticalOffset, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-[99990]" // Extremely high z-index
      style={labelStyle}
      key={`label-${id}-${isHighlighted ? 'highlighted' : 'normal'}`}
    >
      <div style={labelTextStyle} id={labelId}>
        {/* CRITICAL FIX: Always force translate */}
        <TranslatableText 
          text={id} 
          forceTranslate={true}
          style={{ textShadow: '0 0 4px rgba(0,0,0,0.9)', fontWeight: isHighlighted ? 'bold' : 'semibold' }}
        />
      </div>
      
      {/* Add a DOM fallback for browsers where Three.js HTML might fail */}
      <div id={`label-fallback-${labelId}`} 
        className="hidden fixed top-0 left-0 px-2 py-1 bg-black text-white rounded text-sm font-bold z-[100000]"
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 100000,
        }}
      >
        {id}
      </div>
    </Html>
  );
};

export default NodeLabel;
