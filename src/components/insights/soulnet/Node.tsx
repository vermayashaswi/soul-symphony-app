
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { NodeMesh } from './NodeMesh';
import { NodeLabel } from './NodeLabel';
import { ConnectionPercentage } from './ConnectionPercentage';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

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
  translatedLabels?: Map<string, string>;
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
  translatedLabels
}) => {
  const { theme } = useTheme();
  const [isTouching, setIsTouching] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  const prevHighlightedRef = useRef<boolean>(isHighlighted);
  const prevSelectedRef = useRef<boolean>(isSelected);
  
  // Cache translated text to prevent flickering
  const translatedText = useMemo(() => {
    return translatedLabels?.get(node.id) || node.id;
  }, [node.id, translatedLabels]);
  
  // Debug log for visibility with more informative details
  useEffect(() => {
    if (isHighlighted || isSelected) {
      console.log(`Node ${node.id}: highlighted=${isHighlighted}, selected=${isSelected}, showPercentage=${showPercentage}, percentage=${connectionPercentage}, translatedText=${translatedText}`);
    }
    
    // Track state changes that might cause flickering
    if (prevHighlightedRef.current !== isHighlighted || prevSelectedRef.current !== isSelected) {
      prevHighlightedRef.current = isHighlighted;
      prevSelectedRef.current = isSelected;
    }
  }, [isHighlighted, isSelected, showPercentage, node.id, connectionPercentage, translatedText]);
  
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
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

  // Ensure label visibility - use explicit visibility for both NodeLabel and ConnectionPercentage
  const shouldShowLabel = isHighlighted || isSelected || showLabel;
  
  // Always show percentages for highlighted nodes that aren't selected and have a non-zero percentage
  const shouldShowPercentage = showPercentage && isHighlighted && !isSelected && connectionPercentage > 0;
  
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
        translatedText={translatedText}
      />

      <ConnectionPercentage
        position={node.position}
        percentage={connectionPercentage}
        isVisible={shouldShowPercentage}
        offsetY={node.type === 'entity' ? 1.2 : 1.0}
        nodeType={node.type}
      />
    </group>
  );
};

export default Node;
