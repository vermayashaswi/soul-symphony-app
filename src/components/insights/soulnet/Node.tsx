
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import '@/types/three-reference';
import * as THREE from 'three';
import { NodeMesh } from './NodeMesh';
import { NodeLabel } from './NodeLabel';
import { ConnectionPercentage } from './ConnectionPercentage';
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
  const prevHighlightedRef = useRef<boolean>(isHighlighted);
  const prevSelectedRef = useRef<boolean>(isSelected);
  const nodeRef = useRef<{ isAnimating: boolean }>({ isAnimating: false });
  
  // Debug logging for node rendering
  console.log(`[Node] Rendering node ${node.id} at position:`, node.position, 'isHighlighted:', isHighlighted, 'showLabel:', showLabel);
  
  // Clean label visibility logic - only show for selected/highlighted nodes
  const shouldShowLabel = forceShowLabels || showLabel || isHighlighted || isSelected;
  
  // Track state changes that might cause flickering
  useEffect(() => {
    if (prevHighlightedRef.current !== isHighlighted || prevSelectedRef.current !== isSelected) {
      console.log(`Node ${node.id}: State change - highlighted: ${prevHighlightedRef.current} → ${isHighlighted}, selected: ${prevSelectedRef.current} → ${isSelected}`);
      prevHighlightedRef.current = isHighlighted;
      prevSelectedRef.current = isSelected;
      
      // Mark node as animating to stabilize transitions
      nodeRef.current.isAnimating = true;
      
      // Reset animation flag after transition period
      setTimeout(() => {
        nodeRef.current.isAnimating = false;
      }, 300);
    }
  }, [isHighlighted, isSelected, node.id]);
  
  // Restored original scale calculation for better proportions
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

  // Safe pointer down handler with error boundaries
  const handlePointerDown = useCallback((e: any) => {
    try {
      e.stopPropagation();
      setIsTouching(true);
      setTouchStartTime(Date.now());
      setTouchStartPosition({x: e.clientX, y: e.clientY});
      console.log(`Node pointer down: ${node.id}`);
    } catch (error) {
      console.error(`Error in handlePointerDown for node ${node.id}:`, error);
    }
  }, [node.id]);

  // Safe pointer up handler with error boundaries
  const handlePointerUp = useCallback((e: any) => {
    try {
      e.stopPropagation();
      if (touchStartTime && Date.now() - touchStartTime < 300) {
        if (touchStartPosition) {
          const deltaX = Math.abs(e.clientX - touchStartPosition.x);
          const deltaY = Math.abs(e.clientY - touchStartPosition.y);
          
          if (deltaX < 10 && deltaY < 10) {
            console.log(`Node clicked: ${node.id}, isHighlighted: ${isHighlighted}`);
            onClick(node.id, e);
            
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        } else {
          console.log(`Node clicked (no start position): ${node.id}`);
          onClick(node.id, e);
        }
      }
      
      setIsTouching(false);
      setTouchStartTime(null);
      setTouchStartPosition(null);
    } catch (error) {
      console.error(`Error in handlePointerUp for node ${node.id}:`, error);
      // Reset state even if there's an error
      setIsTouching(false);
      setTouchStartTime(null);
      setTouchStartPosition(null);
    }
  }, [node.id, onClick, touchStartTime, touchStartPosition, isHighlighted]);

  // Safe pointer out handler
  const handlePointerOut = useCallback(() => {
    try {
      setIsTouching(false);
    } catch (error) {
      console.error(`Error in handlePointerOut for node ${node.id}:`, error);
    }
  }, [node.id]);

  // Safe pointer leave handler
  const handlePointerLeave = useCallback(() => {
    try {
      setIsTouching(false);
    } catch (error) {
      console.error(`Error in handlePointerLeave for node ${node.id}:`, error);
    }
  }, [node.id]);

  // Safe click handler for the mesh
  const handleMeshClick = useCallback((e: any) => {
    try {
      onClick(node.id, e);
    } catch (error) {
      console.error(`Error in handleMeshClick for node ${node.id}:`, error);
    }
  }, [node.id, onClick]);

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

  // Show percentages for all highlighted nodes that aren't selected and have a non-zero percentage
  const shouldShowPercentage = showPercentage && isHighlighted && connectionPercentage > 0;
  
  // Validate node position before rendering
  if (!Array.isArray(node.position) || node.position.length !== 3) {
    console.error(`Invalid node position for ${node.id}:`, node.position);
    return null;
  }
  
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
        onClick={handleMeshClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
        onPointerLeave={handlePointerLeave}
      />
      
      <NodeLabel
        id={node.id}
        type={node.type}
        position={[0, 0, 0]}
        isHighlighted={isHighlighted}
        shouldShowLabel={shouldShowLabel}
        cameraZoom={cameraZoom}
        themeHex={themeHex}
        forceVisible={forceShowLabels}
        nodeColor={displayColor}
        nodeScale={scale} // Pass the calculated scale for dynamic positioning
      />

      <ConnectionPercentage
        position={node.position}
        percentage={connectionPercentage}
        isVisible={shouldShowPercentage}
        offsetY={0}
        nodeType={node.type}
      />
    </group>
  );
};

export default Node;
