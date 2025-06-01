
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import '@/types/three-reference';
import * as THREE from 'three';
import { NodeMesh } from './NodeMesh';
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
  
  // Validate node data
  const isValidNode = useMemo(() => {
    return node && 
           typeof node.id === 'string' && 
           node.id.length > 0 &&
           (node.type === 'entity' || node.type === 'emotion') &&
           typeof node.value === 'number' &&
           Array.isArray(node.position) &&
           node.position.length === 3 &&
           node.position.every(coord => typeof coord === 'number' && !isNaN(coord));
  }, [node]);

  // Early return for invalid nodes
  if (!isValidNode) {
    console.warn('Invalid node data:', node);
    return null;
  }
  
  // Debug logging for node rendering with throttling
  const logThrottleRef = useRef<number>(0);
  if (Date.now() - logThrottleRef.current > 1000) {
    console.log(`[Node] Rendering node ${node.id} at position:`, node.position, 'isHighlighted:', isHighlighted, 'showLabel:', showLabel);
    logThrottleRef.current = Date.now();
  }
  
  // Track state changes that might cause flickering
  useEffect(() => {
    if (prevHighlightedRef.current !== isHighlighted || prevSelectedRef.current !== isSelected) {
      console.log(`Node ${node.id}: State change - highlighted: ${prevHighlightedRef.current} → ${isHighlighted}, selected: ${prevSelectedRef.current} → ${isSelected}`);
      prevHighlightedRef.current = isHighlighted;
      prevSelectedRef.current = isSelected;
      
      // Mark node as animating to stabilize transitions
      nodeRef.current.isAnimating = true;
      
      // Reset animation flag after transition period
      const timeout = setTimeout(() => {
        nodeRef.current.isAnimating = false;
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [isHighlighted, isSelected, node.id]);
  
  // Safe scale calculation with bounds checking
  const scale = useMemo(() => {
    const baseScale = node.type === 'entity' ? 0.7 : 0.55;
    const valueMultiplier = Math.max(0.1, Math.min(1, node.value || 0.5));
    const strengthMultiplier = Math.max(0, Math.min(1, connectionStrength));
    
    if (isHighlighted) {
      return baseScale * (1.2 + (isSelected ? 0.3 : strengthMultiplier * 0.5));
    }
    return baseScale * (0.8 + valueMultiplier * 0.5);
  }, [node.type, node.value, isHighlighted, isSelected, connectionStrength]);

  // Safe color calculation
  const displayColor = useMemo(() => {
    try {
      if (isHighlighted) {
        return node.type === 'entity' ? '#ffffff' : (themeHex || '#3b82f6');
      }
      return node.type === 'entity'
        ? (dimmed ? (theme === 'dark' ? '#555' : '#999') : '#ccc') 
        : (dimmed ? (theme === 'dark' ? '#555' : '#999') : (themeHex || '#3b82f6'));
    } catch (error) {
      console.warn('Color calculation error:', error);
      return '#ffffff';
    }
  }, [node.type, dimmed, theme, themeHex, isHighlighted]);

  // Safe event handlers with error boundaries
  const handlePointerDown = useCallback((e: any) => {
    try {
      e?.stopPropagation?.();
      setIsTouching(true);
      setTouchStartTime(Date.now());
      setTouchStartPosition({x: e?.clientX || 0, y: e?.clientY || 0});
      console.log(`Node pointer down: ${node.id}`);
    } catch (error) {
      console.warn('Pointer down error:', error);
    }
  }, [node.id]);

  const handlePointerUp = useCallback((e: any) => {
    try {
      e?.stopPropagation?.();
      if (touchStartTime && Date.now() - touchStartTime < 300) {
        if (touchStartPosition) {
          const deltaX = Math.abs((e?.clientX || 0) - touchStartPosition.x);
          const deltaY = Math.abs((e?.clientY || 0) - touchStartPosition.y);
          
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
      console.warn('Pointer up error:', error);
    }
  }, [node.id, onClick, touchStartTime, touchStartPosition, isHighlighted]);

  const handlePointerOut = useCallback(() => {
    try {
      setIsTouching(false);
    } catch (error) {
      console.warn('Pointer out error:', error);
    }
  }, []);

  // Touch timeout cleanup
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
  const shouldShowPercentage = showPercentage && 
                               isHighlighted && 
                               connectionPercentage > 0 &&
                               !isSelected;
  
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
        onPointerOut={handlePointerOut}
        onPointerLeave={handlePointerOut}
      />
      
      {shouldShowPercentage && (
        <ConnectionPercentage
          position={node.position}
          percentage={connectionPercentage}
          isVisible={shouldShowPercentage}
          offsetY={0}
          nodeType={node.type}
        />
      )}
    </group>
  );
};

export default Node;
