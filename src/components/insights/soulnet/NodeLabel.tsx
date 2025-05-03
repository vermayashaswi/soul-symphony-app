
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

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Calculate appropriate size based on camera distance
    // Lower base size for better visibility
    const base = 14 + Math.max(0, (26 - z) * 0.5);
    return Math.max(Math.min(base, 20), 12);
  }, [cameraZoom]);

  const labelStyle = useMemo(() => ({
    transform: isHighlighted ? 'scale(1.1)' : 'scale(1)',
    minWidth: 'auto',
    minHeight: 'auto',
    pointerEvents: 'none' as const,
    fontSize: `${dynamicFontSize}px`,
    fontWeight: isHighlighted ? 800 : 600,
    lineHeight: 1.1,
    zIndex: isHighlighted ? 100000 : 99999,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'transform 0.2s ease-out, font-weight 0.2s ease',
    willChange: 'transform',
    opacity: shouldShowLabel ? 1 : 0,
    textShadow: isHighlighted 
      ? '0 0 5px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8)' 
      : '0 0 4px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.7)'
  }), [dynamicFontSize, shouldShowLabel, isHighlighted]);

  const labelTextStyle = useMemo(() => ({
    color: type === 'entity' ? '#fff' : themeHex,
    padding: '0.2rem 0.4rem',
    fontWeight: isHighlighted ? 'bold' : 'normal',
    backgroundColor: isHighlighted ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.65)', // Even darker background for better visibility
    borderRadius: '4px',
    boxShadow: isHighlighted ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
    border: '1px solid rgba(255,255,255,0.1)', // Subtle border for better definition
  }), [type, themeHex, isHighlighted]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  return (
    <Html
      position={[0, type === 'entity' ? 0.9 : 1.0, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-40"
      style={labelStyle}
      key={`label-${id}-${isHighlighted ? 'highlighted' : 'normal'}`}
    >
      <div style={labelTextStyle}>
        <TranslatableText 
          text={id} 
          forceTranslate={true}
          style={{ textShadow: '0 0 3px rgba(0,0,0,0.9)' }}
        />
      </div>
    </Html>
  );
};

export default NodeLabel;
