
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import UnifiedNodeLabel from './UnifiedNodeLabel';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
  scale?: number;
  isHighlighted?: boolean;
}

interface NodeProps {
  node: NodeData;
  isSelected: boolean;
  onClick: (id: string, event: any) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom?: number;
  isHighlighted: boolean;
  connectionPercentage?: number;
  showPercentage?: boolean;
  forceShowLabels?: boolean;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  userId?: string;
  timeRange?: string;
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
  cameraZoom = 62.5,
  isHighlighted,
  connectionPercentage = 0,
  showPercentage = false,
  forceShowLabels = false,
  effectiveTheme = 'light',
  isInstantMode = false,
  userId,
  timeRange
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Stable node properties with improved colors
  const nodeScale = useMemo(() => {
    const baseScale = node.type === 'entity' ? 0.7 : 0.55;
    const connectionScale = isHighlighted ? (1.2 + (isSelected ? 0.3 : 0.4)) : (0.8 + node.value * 0.5);
    return baseScale * connectionScale;
  }, [node.type, node.value, isHighlighted, isSelected]);

  const nodeColor = useMemo(() => {
    if (dimmed) {
      return '#666666';
    }
    
    if (node.type === 'entity') {
      return isSelected ? '#32CD32' : (isHighlighted ? '#7CFC00' : '#90EE90');
    } else {
      return isSelected ? '#FF9800' : (isHighlighted ? '#FFB74D' : '#F57C00');
    }
  }, [node.type, isSelected, isHighlighted, dimmed]);

  const handlePointerOver = useCallback((event: any) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback((event: any) => {
    event.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  const handleClick = useCallback((event: any) => {
    event.stopPropagation();
    onClick(node.id, event);
  }, [onClick, node.id]);

  // Always show labels when requested
  const stableLabelVisibility = useMemo(() => {
    return forceShowLabels || showLabel;
  }, [forceShowLabels, showLabel]);

  // Smooth scale animation
  useFrame(() => {
    if (meshRef.current) {
      const targetScale = hovered ? nodeScale * 1.1 : nodeScale;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  console.log(`[Node] Rendering: ${node.id} (${node.type}) - scale: ${nodeScale}, color: ${nodeColor}, labels: ${stableLabelVisibility}, userId: ${userId}, timeRange: ${timeRange}`);

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        scale={[nodeScale, nodeScale, nodeScale]}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={nodeColor}
          transparent={dimmed}
          opacity={dimmed ? 0.3 : 1.0}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      
      <UnifiedNodeLabel
        id={node.id}
        type={node.type}
        position={[0, 0, 0]}
        isHighlighted={isHighlighted}
        isSelected={isSelected}
        shouldShowLabel={stableLabelVisibility}
        cameraZoom={cameraZoom}
        themeHex={themeHex}
        nodeScale={nodeScale}
        connectionPercentage={connectionPercentage}
        showPercentage={showPercentage}
        effectiveTheme={effectiveTheme}
        userId={userId}
        timeRange={timeRange}
      />
    </group>
  );
};

export default Node;
