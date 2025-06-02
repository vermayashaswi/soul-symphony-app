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
  
  console.log(`[Node] Rendering node ${node.id} - highlighted: ${isHighlighted}, showPercentage: ${showPercentage}, percentage: ${connectionPercentage}%`);
  
  // Simplified label visibility logic
  const shouldShowLabel = forceShowLabels || showLabel || isHighlighted || isSelected;
  
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

  // ... keep existing code (touch handlers and effects)

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

  // Enhanced percentage visibility with more detailed logging
  const shouldShowPercentage = useMemo(() => {
    const hasValidPercentage = connectionPercentage > 0;
    const isConnectedNode = isHighlighted && !isSelected; // Connected to selected node, but not the selected node itself
    const shouldShow = showPercentage && hasValidPercentage && isConnectedNode;
    
    console.log(`[Node] Percentage visibility for ${node.id}:`, {
      showPercentage,
      hasValidPercentage,
      isConnectedNode,
      isHighlighted,
      isSelected,
      shouldShow,
      percentage: connectionPercentage
    });
    
    return shouldShow;
  }, [showPercentage, connectionPercentage, isHighlighted, isSelected, node.id]);
  
  console.log(`[Node] Final render decisions for ${node.id} - Label: ${shouldShowLabel}, Percentage: ${shouldShowPercentage} (${connectionPercentage}%)`);
  
  return (
    <group position={node.position}>
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
        themeHex={themeHex}
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
};

export default Node;
