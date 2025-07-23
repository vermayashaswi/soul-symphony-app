
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

  // PHASE 1 FIX: Enhanced coordinated translation with better logging
  const coordinatedTranslation = useMemo(() => {
    if (getCoordinatedTranslation) {
      const translation = getCoordinatedTranslation(node.id);
      console.log(`[Node] PHASE 1 FIX: Coordinated translation for ${node.id}: "${translation}"`);
      return translation;
    }
    return undefined;
  }, [node.id, getCoordinatedTranslation]);

  // PHASE 1 FIX: Enhanced scale calculation with better visual hierarchy
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.15;
    if (isSelected) return baseScale * 1.8; // Much larger for selected
    if (isHighlighted) return baseScale * 1.4; // Larger for highlighted
    if (dimmed) return baseScale * 0.5; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, dimmed]);

  // PHASE 1 FIX: Enhanced color calculation with better contrast
  const displayColor = useMemo(() => {
    if (isSelected) {
      // Selected state: Use much darker shades for maximum contrast
      if (node.type === 'entity') {
        return "#0f4c15"; // Much darker green for selected entity nodes
      } else {
        return "#a84b0b"; // Much darker golden for selected emotion nodes
      }
    }
    
    if (isHighlighted) {
      // Highlighted state: Use vibrant colors
      if (node.type === 'entity') {
        return "#16a34a"; // Vibrant green for highlighted entity nodes
      } else {
        return "#ea580c"; // Vibrant orange for highlighted emotion nodes
      }
    }
    
    // Dimmed or normal state
    return dimmed ? '#2a2a2a' : '#666666';
  }, [isSelected, isHighlighted, dimmed, node.type]);

  // Manual time tracking for animations
  useFrame((state, delta) => {
    if (!isReady) return;
    setAnimationTime(prev => prev + delta);
  });

  // PHASE 1 FIX: Enhanced node click handler
  const handleNodeClick = (e: any) => {
    console.log(`[Node] PHASE 1 FIX: Click event for node ${node.id}`, {
      nodeId: node.id,
      nodeType: node.type,
      isSelected,
      isHighlighted,
      dimmed,
      connectionPercentage
    });
    
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    try {
      onClick(node.id);
      console.log(`[Node] PHASE 1 FIX: onClick handler called for node ${node.id}`);
    } catch (error) {
      console.error(`[Node] PHASE 1 FIX: Error in onClick handler:`, error);
    }
  };

  // Handle pointer events with better mobile support
  const handlePointerDown = (e: any) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  };

  const handlePointerUp = (e: any) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  };

  const handlePointerOut = () => {
    // Handle pointer out
  };

  const handlePointerLeave = () => {
    // Handle pointer leave
  };

  // PHASE 1 FIX: Enhanced label visibility logic
  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false;
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, dimmed]);

  // PHASE 1 FIX: Enhanced percentage display logging
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[Node] PHASE 1 FIX: ${node.id} displaying percentage: ${connectionPercentage}% with translation: "${coordinatedTranslation}"`);
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
          position={[0, 0, 0]}
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
