
import React, { useMemo } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';

// Enhanced adaptive text color with better contrast
const getAdaptiveTextColor = (nodeColor: string, nodeType: 'entity' | 'emotion', theme: string, isHighlighted: boolean, isSelected: boolean): string => {
  if (isSelected) {
    return theme === 'light' ? '#000000' : '#ffffff';
  }
  
  if (isHighlighted) {
    if (nodeType === 'emotion') {
      return theme === 'light' ? '#2563eb' : '#60a5fa';
    } else {
      return theme === 'light' ? '#dc2626' : '#f87171';
    }
  }
  
  return theme === 'light' ? '#666666' : '#999999';
};

// Enhanced label offset calculation
const calculateLabelOffset = (nodeType: 'entity' | 'emotion', nodeScale: number): number => {
  if (nodeType === 'entity') {
    const sphereRadius = 1.4;
    return sphereRadius * nodeScale * 1.3;
  } else {
    const cubeSize = 2.1;
    const cornerDistance = Math.sqrt(3) * (cubeSize / 2);
    return cornerDistance * nodeScale * 1.3;
  }
};

interface NodeLabelProps {
  id: string;
  type: 'entity' | 'emotion';
  position: [number, number, number];
  isHighlighted: boolean;
  isSelected: boolean;
  shouldShowLabel: boolean;
  cameraZoom?: number;
  themeHex: string;
  forceVisible?: boolean;
  nodeColor?: string;
  nodeScale?: number;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  id,
  type,
  position,
  isHighlighted,
  isSelected,
  shouldShowLabel,
  cameraZoom,
  themeHex,
  forceVisible = false,
  nodeColor = '#ffffff',
  nodeScale = 1
}) => {
  const { theme } = useTheme();
  
  console.log(`[NodeLabel] Rendering label for node ${id}, shouldShow: ${shouldShowLabel}`);
  
  // Stabilized visibility logic to prevent flickering
  const isVisible = useMemo(() => {
    return shouldShowLabel || forceVisible || isSelected || isHighlighted;
  }, [shouldShowLabel, forceVisible, isSelected, isHighlighted]);

  // Enhanced dynamic font sizing
  const dynamicFontSize = useMemo(() => {
    let z = cameraZoom !== undefined ? cameraZoom : 45;
    if (typeof z !== 'number' || Number.isNaN(z)) z = 45;
    
    const baseSize = 0.35 + Math.max(0, (45 - z) * 0.007);
    const minSize = 0.28;
    const maxSize = 0.65;
    
    return Math.max(Math.min(baseSize, maxSize), minSize);
  }, [cameraZoom]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Enhanced geometric positioning
  const geometricOffset = useMemo(() => {
    return calculateLabelOffset(type, nodeScale);
  }, [type, nodeScale]);

  // Enhanced adaptive text color
  const textColor = useMemo(() => {
    return getAdaptiveTextColor(nodeColor, type, theme, isHighlighted, isSelected);
  }, [nodeColor, type, theme, isHighlighted, isSelected]);

  const labelPosition: [number, number, number] = [0, geometricOffset, 0];
  
  console.log(`[NodeLabel] Rendering TranslatableText for "${id}", fontSize: ${dynamicFontSize}`);

  return (
    <group position={labelPosition}>
      <TranslatableText
        text={id}
        as="div"
        forceTranslate={true}
        style={{
          color: textColor,
          fontSize: `${dynamicFontSize}rem`,
          fontWeight: (isHighlighted || isSelected) ? 'bold' : 'normal',
          textAlign: 'center',
          textShadow: isSelected 
            ? `2px 2px 4px ${theme === 'light' ? '#000000' : '#ffffff'}` 
            : `1px 1px 2px ${theme === 'light' ? '#333333' : '#cccccc'}`,
          maxWidth: '25ch',
          wordWrap: 'break-word',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      />
    </group>
  );
};

export default NodeLabel;
