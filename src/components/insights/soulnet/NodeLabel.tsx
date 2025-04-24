
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';

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
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 26;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    const base = 12.825 + Math.max(0, (z - 18) * 0.8);
    return Math.round(Math.max(Math.min(base, 32.4), 11.88) * 100) / 100;
  }, [cameraZoom]);

  const labelStyle = useMemo(() => ({
    transform: isHighlighted ? 'scale(1.1) !important' : 'scale(1) !important',
    minWidth: 'auto',
    minHeight: 'auto',
    pointerEvents: 'none' as const,
    fontSize: `${dynamicFontSize}px`,
    fontWeight: isHighlighted ? 800 : 600,
    lineHeight: 1.1,
    zIndex: isHighlighted ? 100000 : 99999,
    userSelect: 'text' as const,
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
    padding: '0.1rem 0.2rem',
    fontWeight: isHighlighted ? 'bold' : 'normal',
  }), [type, themeHex, isHighlighted]);

  return shouldShowLabel ? (
    <Html
      position={[0, type === 'entity' ? 1.2 : 1.4, 0]}
      center
      distanceFactor={1.2}
      occlude={false}
      className="z-40"
      style={labelStyle}
      key={`label-${id}-${isHighlighted ? 'highlighted' : 'normal'}`}
    >
      <div style={labelTextStyle}>{id}</div>
    </Html>
  ) : null;
};
