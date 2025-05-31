
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import '@/types/three-reference';  // Fixed import path
import * as THREE from 'three';
import { NodeMesh } from './NodeMesh';
import { NodeLabel } from './NodeLabel';
import { ConnectionPercentage } from './ConnectionPercentage';
import { useTheme } from '@/hooks/use-theme';
import { useTutorial } from '@/contexts/TutorialContext';

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
  forceShowLabels?: boolean; // New prop for tutorial mode
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
  const { isInStep } = useTutorial();
  const [isTouching, setIsTouching] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  const prevHighlightedRef = useRef<boolean>(isHighlighted);
  const prevSelectedRef = useRef<boolean>(isSelected);
  const nodeRef = useRef<{ isAnimating: boolean }>({ isAnimating: false });
  
  // Enhanced label visibility for tutorial step 9
  const isTutorialStep9 = isInStep(9);
  const shouldShowLabel = isTutorialStep9 || forceShowLabels || showLabel || isHighlighted || isSelected;
  
  // Enhanced debug logging for tutorial step 9
  useEffect(() => {
    if (isTutorialStep9) {
      console.log(`[Node] Tutorial Step 9 - ${node.id} (${node.type}):`, {
        position: node.position,
        shouldShowLabel,
        showLabel,
        forceShowLabels,
        isHighlighted,
        isSelected,
        isTutorialStep9
      });
    }
  }, [node.id, node.type, node.position, shouldShowLabel, showLabel, forceShowLabels, isHighlighted, isSelected, isTutorialStep9]);
  
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
  
  // Enhanced scale calculation with tutorial mode adjustments
  const baseScale = node.type === 'entity' ? 0.7 : 0.55;
  const tutorialScaleBoost = isTutorialStep9 ? 1.1 : 1; // Slightly larger nodes in tutorial
  const scale = (isHighlighted 
    ? baseScale * (1.2 + (isSelected ? 0.3 : connectionStrength * 0.5))
    : baseScale * (0.8 + node.value * 0.5)) * tutorialScaleBoost;

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
    console.log(`Node pointer down: ${node.id}`);
  }, [node.id]);

  const handlePointerUp = useCallback((e: any) => {
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
  }, [node.id, onClick, touchStartTime, touchStartPosition, isHighlighted]);

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
      
      <NodeLabel
        id={node.id}
        type={node.type}
        position={node.position}
        isHighlighted={isHighlighted}
        shouldShowLabel={shouldShowLabel}
        cameraZoom={cameraZoom}
        themeHex={themeHex}
        forceVisible={isTutorialStep9 || forceShowLabels} // Pass tutorial state
      />

      {/* Place the percentage display in front of the node */}
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
