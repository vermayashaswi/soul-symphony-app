
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import '@/types/three-reference';
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
  isFullScreen?: boolean;
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
  isFullScreen = false
}) => {
  const { theme } = useTheme();
  const { isInStep } = useTutorial();
  const [isTouching, setIsTouching] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  
  const isTutorialStep9 = isInStep(9);
  
  // Original label visibility logic
  const shouldShowLabel = useMemo(() => {
    // Always show in tutorial step 9
    if (isTutorialStep9) {
      return true;
    }
    
    // Show if this is the selected node
    if (isSelected) {
      return true;
    }
    
    // Show if this node is highlighted (connected to selected node)
    if (isHighlighted) {
      return true;
    }
    
    // Show if no node is selected and showLabel is true
    if (!selectedNodeId && showLabel) {
      return true;
    }
    
    // Show in fullscreen mode
    if (isFullScreen) {
      return true;
    }
    
    return false;
  }, [isTutorialStep9, isSelected, isHighlighted, selectedNodeId, showLabel, isFullScreen]);
  
  // Original node scale calculation
  const baseScale = node.type === 'entity' ? 0.7 : 0.55;
  const tutorialScaleBoost = isTutorialStep9 ? 1.1 : 1;
  const highlightScale = isHighlighted ? 1.3 : 1;
  const scale = baseScale * tutorialScaleBoost * highlightScale;

  // Original color calculation
  const displayColor = useMemo(() => {
    if (isHighlighted) {
      return node.type === 'entity' ? '#ffffff' : themeHex;
    }
    
    if (dimmed) {
      return theme === 'dark' ? '#555555' : '#999999';
    }
    
    return node.type === 'entity' ? '#cccccc' : themeHex;
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
        shouldShowLabel={shouldShowLabel}
        isTutorialMode={isTutorialStep9}
        themeHex={themeHex}
        isHighlighted={isHighlighted}
        cameraZoom={cameraZoom}
        isFullScreen={isFullScreen}
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
