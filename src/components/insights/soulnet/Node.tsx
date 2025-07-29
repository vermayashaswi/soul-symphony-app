
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import { useUserColorThemeHex } from './useUserColorThemeHex';
import NodeMesh from './NodeMesh';

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
  onClick: (id: string, event?: any) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom: number;
  isHighlighted: boolean;
  connectionPercentage?: number;
  showPercentage?: boolean;
  forceShowLabels?: boolean;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  // ENHANCED: Coordinated translation props
  getCoordinatedTranslation?: (nodeId: string) => string;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  showLabel,
  dimmed,
  themeHex,
  selectedNodeId,
  cameraZoom,
  isHighlighted,
  connectionPercentage = 0,
  showPercentage = false,
  forceShowLabels = false,
  effectiveTheme = 'light',
  isInstantMode = false,
  getCoordinatedTranslation
}) => {
  const [animationTime, setAnimationTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const userColorThemeHex = useUserColorThemeHex();
  const groupRef = useRef<THREE.Group>(null);
  
  // Delayed initialization to prevent clock access issues
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // ENHANCED COORDINATED TRANSLATION: Get coordinated translation for this node with better debugging
  const coordinatedTranslation = useMemo(() => {
    if (getCoordinatedTranslation) {
      const translation = getCoordinatedTranslation(node.id);
      if (isInstantMode) {
        console.log(`[Node] ENHANCED COORDINATED INSTANT: Got coordinated translation for ${node.id}: "${translation}" - NO LOADING DELAY`);
      } else {
        console.log(`[Node] ENHANCED COORDINATED: Got coordinated translation for ${node.id}: "${translation}"`);
      }
      return translation;
    }
    if (isInstantMode) {
      console.log(`[Node] ENHANCED COORDINATED INSTANT: No coordinated translation function available for ${node.id} - NO LOADING DELAY`);
    } else {
      console.log(`[Node] ENHANCED COORDINATED: No coordinated translation function available for ${node.id}`);
    }
    return undefined;
  }, [node.id, getCoordinatedTranslation, isInstantMode]);

  // FIXED: More dramatic scale differences for better hierarchy
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.15;
    if (isSelected) return baseScale * 1.6; // Even larger for selected
    if (isHighlighted) return baseScale * 1.3; // Larger for highlighted
    if (dimmed) return baseScale * 0.6; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, dimmed]);

  // Calculate the display color based on node state
  const displayColor = useMemo(() => {
    if (isSelected) {
      // Selected state: Use darker shades
      if (node.type === 'entity') {
        return "#14532d"; // Much darker green for selected entity nodes
      } else {
        return "#b45309"; // Much darker golden for selected emotion nodes
      }
    }
    
    if (isHighlighted || (!dimmed && !isSelected)) {
      // Default state: Use the new darker colors for both highlighted and normal nodes
      if (node.type === 'entity') {
        return "#15803d"; // Darker green for entity nodes (spheres)
      } else {
        return "#d97706"; // Darker golden for emotion nodes (cubes)
      }
    }
    
    // ENHANCED: 20% lighter colors for dimmed nodes instead of very dark
    return dimmed ? '#3a3a3a' : '#cccccc';
  }, [isSelected, isHighlighted, dimmed, node.type]);

  // Manual time tracking for animations
  useFrame((state, delta) => {
    if (!isReady) return;
    setAnimationTime(prev => prev + delta);
  });

  // FIXED: Node click handler with better mobile support
  const handleNodeClick = (e: any) => {
    console.log(`[Node] SOUL-NET SELECTION FIX: Click event triggered for node ${node.id}`, {
      nodeId: node.id,
      nodeType: node.type,
      isSelected,
      isHighlighted,
      dimmed
    });
    
    // Stop event propagation to prevent canvas click
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // Call the onClick handler with a delay to avoid React state update race conditions
    try {
      onClick(node.id);
      console.log(`[Node] SOUL-NET SELECTION FIX: onClick handler called successfully for node ${node.id}`);
    } catch (error) {
      console.error(`[Node] SOUL-NET SELECTION FIX: Error in onClick handler for node ${node.id}:`, error);
    }
  };

  // Handle pointer down event with better mobile support
  const handlePointerDown = (e: any) => {
    console.log(`[Node] SOUL-NET SELECTION FIX: Pointer down event for node ${node.id}`);
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  };

  // Handle pointer up event with better mobile support
  const handlePointerUp = (e: any) => {
    console.log(`[Node] SOUL-NET SELECTION FIX: Pointer up event for node ${node.id}`);
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  };

  // Handle pointer out and leave events
  const handlePointerOut = () => {
    console.log(`[Node] SOUL-NET SELECTION FIX: Pointer out event for node ${node.id}`);
  };

  const handlePointerLeave = () => {
    console.log(`[Node] SOUL-NET SELECTION FIX: Pointer leave event for node ${node.id}`);
  };

  // FIXED: Show labels for selected node and all connected nodes
  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false; // Never show labels for dimmed nodes
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, dimmed]);

  // ENHANCED INSTANT MODE: Better logging for coordinated translation tracking
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[Node] ENHANCED COORDINATED PULSATING INSTANT MODE: ${node.id} (${node.type}) displays percentage: ${connectionPercentage}% with coordinated translation: "${coordinatedTranslation}" - NO LOADING DELAY`);
    } else {
      console.log(`[Node] ENHANCED COORDINATED PULSATING: ${node.id} (${node.type}) should display percentage: ${connectionPercentage}% with coordinated translation: "${coordinatedTranslation}"`);
    }
  }

  // Don't render until ready
  if (!isReady) {
    return null;
  }

  return (
    <group ref={groupRef} position={node.position}>
      <NodeMesh
        type={node.type}
        scale={baseNodeScale}
        displayColor={displayColor}
        isHighlighted={isHighlighted}
        dimmed={dimmed}
        connectionStrength={connectionPercentage / 100}
        isSelected={isSelected}
        onClick={handleNodeClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
        onPointerLeave={handlePointerLeave}
      />
      
      {shouldShowLabel && (
        <DirectNodeLabel
          id={node.id}
          type={node.type}
          position={[0, 0, 0]} // Relative to group
          isHighlighted={isHighlighted}
          isSelected={isSelected}
          shouldShowLabel={shouldShowLabel}
          cameraZoom={cameraZoom}
          themeHex={themeHex}
          nodeScale={baseNodeScale}
          connectionPercentage={connectionPercentage}
          showPercentage={showPercentage}
          effectiveTheme={effectiveTheme}
          isInstantMode={isInstantMode}
          coordinatedTranslation={coordinatedTranslation}
        />
      )}
    </group>
  );
};

export default Node;
