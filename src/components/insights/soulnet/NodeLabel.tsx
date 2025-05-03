import React, { useMemo } from 'react';
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
  console.log(`NodeLabel for "${id}": isHighlighted=${isHighlighted}, shouldShowLabel=${shouldShowLabel}, type=${type}`);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Higher base size for better visibility, but reduced by 30%
    const base = (16 + Math.max(0, (26 - z) * 0.6)) * 0.7;
    return Math.max(Math.min(base, 15.4), 9.8);
  }, [cameraZoom]);

  // Keep node labels at a consistent position, lower than percentage labels
  // Use different vertical positions for entity vs emotion nodes
  const verticalPosition = type === 'entity' ? 0.9 : 0.8;
  
  const labelStyle = {
    transform: isHighlighted ? 'scale(1.2)' : 'scale(1.1)',
    fontSize: `${dynamicFontSize}px`,
    fontWeight: isHighlighted ? 800 : 600,
    lineHeight: 1.1,
    zIndex: 9999,
    color: type === 'entity' ? '#fff' : themeHex,
    padding: '0.2rem 0.4rem',
    backgroundColor: 'transparent',
    borderRadius: '4px',
    textShadow: isHighlighted 
      ? '0 0 6px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9)' 
      : '0 0 5px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8)',
    opacity: 1,
    whiteSpace: 'nowrap',
    display: 'block'
  };

  // The issue might be with the nested Html components
  // Let's use TranslatableText directly within a single Html component
  return (
    <Html
      position={[0, verticalPosition, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-[9999]"
      key={`label-${id}-${isHighlighted ? 'highlighted' : 'normal'}`}
    >
      <div className="node-label-container" style={{ 
        pointerEvents: 'none', 
        margin: 0, 
        padding: 0,
        whiteSpace: 'nowrap'
      }}>
        <TranslatableText
          text={id}
          style={labelStyle}
          forceTranslate={true}
        />
      </div>
    </Html>
  );
};

export default NodeLabel;
