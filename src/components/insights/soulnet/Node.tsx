
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '@/types/three-reference';
import { NodeMesh } from './NodeMesh';
import DirectNodeLabel from './DirectNodeLabel';
import FixedConnectionPercentage from './FixedConnectionPercentage';
import { useTheme } from '@/hooks/use-theme';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface NodeProps {
  node: NodeData;
  isSelected: boolean;
  onClick: (id: string, e: any) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom?: number;
  isHighlighted?: boolean;
  connectionStrength?: number;
  connectionPercentage?: number;
  showPercentage?: boolean;
  forceShowLabels?: boolean;
}

export const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  showLabel,
  dimmed,
  themeHex,
  selectedNodeId,
  cameraZoom,
  isHighlighted = false,
  connectionStrength = 0.5,
  connectionPercentage = 0,
  showPercentage = false,
  forceShowLabels = false
}) => {
  const { theme } = useTheme();
  const [isTouching, setIsTouching] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  
  console.log(`[Node] Rendering node ${node?.id || 'unknown'} with labels - highlighted: ${isHighlighted}, selected: ${isSelected}`);
  
  // Validate node data
  if (!node || !node.id) {
    console.warn('[Node] Invalid node data provided');
    return null;
  }

  // Simplified label visibility logic with proper validation
  const shouldShowLabel = useMemo(() => {
    try {
      return forceShowLabels || showLabel || isHighlighted || isSelected;
    } catch (error) {
      console.warn('[Node] Error calculating label visibility:', error);
      return false;
    }
  }, [forceShowLabels, showLabel, isHighlighted, isSelected]);
  
  // Simplified scale calculation with validation
  const scale = useMemo(() => {
    try {
      const baseScale = node.type === 'entity' ? 0.7 : 0.55;
      const nodeValue = Math.max(0.1, Math.min(1, node.value || 0.5));
      
      if (isHighlighted) {
        const highlightBonus = 1.2 + (isSelected ? 0.3 : connectionStrength * 0.5);
        return baseScale * highlightBonus;
      }
      
      return baseScale * (0.8 + nodeValue * 0.5);
    } catch (error) {
      console.warn('[Node] Error calculating scale:', error);
      return 0.7;
    }
  }, [node.type, node.value, isHighlighted, isSelected, connectionStrength]);

  const displayColor = useMemo(() => {
    try {
      if (isHighlighted) {
        return node.type === 'entity' ? '#ffffff' : (themeHex || '#3b82f6');
      }
      
      const dimmedColor = theme === 'dark' ? '#555' : '#999';
      const normalEntityColor = '#ccc';
      const normalEmotionColor = themeHex || '#3b82f6';
      
      if (dimmed) {
        return dimmedColor;
      }
      
      return node.type === 'entity' ? normalEntityColor : normalEmotionColor;
    } catch (error) {
      console.warn('[Node] Error calculating display color:', error);
      return '#ffffff';
    }
  }, [node.type, dimmed, theme, themeHex, isHighlighted]);

  const handlePointerDown = useCallback((e: any) => {
    try {
      e.stopPropagation();
      setIsTouching(true);
      setTouchStartTime(Date.now());
      setTouchStartPosition({x: e.clientX || 0, y: e.clientY || 0});
    } catch (error) {
      console.warn('[Node] Error in pointer down handler:', error);
    }
  }, []);

  const handlePointerUp = useCallback((e: any) => {
    try {
      e.stopPropagation();
      
      if (touchStartTime && Date.now() - touchStartTime < 300) {
        if (touchStartPosition) {
          const deltaX = Math.abs((e.clientX || 0) - touchStartPosition.x);
          const deltaY = Math.abs((e.clientY || 0) - touchStartPosition.y);
          
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
    } catch (error) {
      console.warn('[Node] Error in pointer up handler:', error);
    }
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

  const shouldShowPercentage = useMemo(() => {
    try {
      return showPercentage && isHighlighted && connectionPercentage > 0;
    } catch (error) {
      console.warn('[Node] Error calculating percentage visibility:', error);
      return false;
    }
  }, [showPercentage, isHighlighted, connectionPercentage]);
  
  console.log(`[Node] Final render decisions - Label: ${shouldShowLabel}, Percentage: ${shouldShowPercentage} (${connectionPercentage}%)`);
  
  try {
    return (
      <group position={node.position || [0, 0, 0]}>
        <NodeMesh
          type={node.type}
          scale={scale}
          displayColor={displayColor}
          isHighlighted={isHighlighted}
          dimmed={dimmed}
          connectionStrength={connectionStrength}
          isSelected={isSelected}
          onClick={(e) => onClick(node.id, e)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerOut={() => setIsTouching(false)}
          onPointerLeave={() => setIsTouching(false)}
        />
        
        <DirectNodeLabel
          id={node.id}
          type={node.type}
          position={[0, 0, 0]}
          isHighlighted={isHighlighted}
          isSelected={isSelected}
          shouldShowLabel={shouldShowLabel}
          cameraZoom={cameraZoom}
          themeHex={themeHex || '#3b82f6'}
          nodeScale={scale}
        />

        <FixedConnectionPercentage
          position={[0, 0, 0]}
          percentage={connectionPercentage}
          isVisible={shouldShowPercentage}
          nodeType={node.type}
        />
      </group>
    );
  } catch (error) {
    console.error('[Node] Error rendering node:', error);
    return null;
  }
};

export default Node;
