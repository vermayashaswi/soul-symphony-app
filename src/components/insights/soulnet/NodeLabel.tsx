
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

  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    
    // Higher base size for better visibility
    const base = 16 + Math.max(0, (26 - z) * 0.6);
    return Math.max(Math.min(base, 22), 14);
  }, [cameraZoom]);

  const labelStyle = useMemo(() => ({
    transform: isHighlighted ? 'scale(1.2)' : 'scale(1.1)',
    minWidth: 'auto',
    minHeight: 'auto',
    pointerEvents: 'none' as const,
    fontSize: `${dynamicFontSize}px`,
    fontWeight: isHighlighted ? 800 : 600,
    lineHeight: 1.1,
    zIndex: 9999,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'transform 0.2s ease-out, font-weight 0.2s ease',
    willChange: 'transform',
    opacity: 1,
    textShadow: isHighlighted 
      ? '0 0 6px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9)' 
      : '0 0 5px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8)'
  }), [dynamicFontSize, shouldShowLabel, isHighlighted]);

  const labelTextStyle = useMemo(() => ({
    color: type === 'entity' ? '#fff' : themeHex,
    padding: '0.2rem 0.4rem',
    fontWeight: isHighlighted ? 'bold' : 'normal',
    backgroundColor: isHighlighted ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
    border: isHighlighted ? `1px solid ${type === 'entity' ? '#ffffff40' : themeHex + '40'}` : 'none',
  }), [type, themeHex, isHighlighted]);

  // Don't render if not supposed to be shown
  if (!shouldShowLabel) return null;

  return (
    <Html
      position={[0, type === 'entity' ? 0.9 : 1.0, 0]}
      center
      distanceFactor={15}
      occlude={false}
      className="z-[9999]"
      style={labelStyle}
      key={`label-${id}-${isHighlighted ? 'highlighted' : 'normal'}`}
    >
      <div style={labelTextStyle}>
        <TranslatableText 
          text={id} 
          forceTranslate={true} 
          style={{ 
            textShadow: '0 0 3px rgba(0,0,0,0.9)',
            color: labelTextStyle.color,
            fontWeight: isHighlighted ? 'bold' : 'normal',
          }}
        />
      </div>
    </Html>
  );
};

export default NodeLabel;
