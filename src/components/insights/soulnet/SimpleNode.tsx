
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import SimpleNodeMesh from './SimpleNodeMesh';
import { useTheme } from '@/hooks/use-theme';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface SimpleNodeProps {
  node: NodeData;
  isSelected: boolean;
  onClick: (id: string, e: any) => void;
  highlightedNodes: Set<string>;
  dimmed: boolean;
  themeHex: string;
  isHighlighted?: boolean;
  connectionStrength?: number;
}

export const SimpleNode: React.FC<SimpleNodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  dimmed,
  themeHex,
  isHighlighted = false,
  connectionStrength = 0.5
}) => {
  const { theme } = useTheme();
  const [isTouching, setIsTouching] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  
  console.log(`[SimpleNode] Rendering node ${node.id} - highlighted: ${isHighlighted}, selected: ${isSelected}`);
  
  // Simplified scale calculation
  const baseScale = node.type === 'entity' ? 0.7 : 0.55;
  const scale = isHighlighted 
    ? baseScale * (1.2 + (isSelected ? 0.3 : connectionStrength * 0.5))
    : baseScale * (0.8 + node.value * 0.5);

  const displayColor = useMemo(() => {
    if (isHighlighted) {
      return node.type === 'entity' ? '#ffffff' : themeHex;
    }
    return node.type === 'entity'
      ? (dimmed ? (theme === 'dark' ? '#555' : '#999') : '#ccc') 
      : (dimmed ? (theme === 'dark' ? '#555' : '#999') : themeHex);
  }, [node.type, dimmed, theme, themeHex, isHighlighted]);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setIsTouching(true);
    setTouchStartTime(Date.now());
    setTouchStartPosition({x: e.clientX, y: e.clientY});
  }, []);

  const handlePointerUp = useCallback((e: any) => {
    e.stopPropagation();
    if (touchStartTime && Date.now() - touchStartTime < 300) {
      if (touchStartPosition) {
        const deltaX = Math.abs(e.clientX - touchStartPosition.x);
        const deltaY = Math.abs(e.clientY - touchStartPosition.y);
        
        if (deltaX < 10 && deltaY < 10) {
          onClick(node.id, e);
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      } else {
        onClick(node.id, e);
      }
    }
    
    setIsTouching(false);
    setTouchStartTime(null);
    setTouchStartPosition(null);
  }, [node.id, onClick, touchStartTime, touchStartPosition]);

  useEffect(() => {
    if (isTouching && touchStartTime) {
      const timer = setTimeout(() => {
        if (isTouching) {
          setIsTouching(false);
          setTouchStartTime(null);
          setTouchStartPosition(null);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isTouching, touchStartTime]);
  
  return (
    <group position={node.position}>
      <SimpleNodeMesh
        type={node.type}
        scale={scale}
        displayColor={displayColor}
        isHighlighted={isHighlighted}
        dimmed={dimmed}
        isSelected={isSelected}
        onClick={(e) => onClick(node.id, e)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={() => setIsTouching(false)}
        onPointerLeave={() => setIsTouching(false)}
      />
    </group>
  );
};

export default SimpleNode;
