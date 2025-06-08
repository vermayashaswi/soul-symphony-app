
import React, { useRef, useState, useCallback, useMemo } from 'react';
import '@/types/three-reference';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import TranslatableText3D from './TranslatableText3D';

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
  onClick: (id: string, event: any) => void;
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
  effectiveTheme?: string;
  isInstantMode?: boolean;
  getInstantTranslation?: (nodeId: string) => string;
  nodeId?: string;
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
  forceShowLabels = true,
  effectiveTheme = 'light',
  isInstantMode = false,
  getInstantTranslation,
  nodeId
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  const baseScale = node.type === 'entity' ? 0.7 : 0.55;
  const targetScale = isHighlighted 
    ? baseScale * (1.2 + (isSelected ? 0.3 : 0.5))
    : baseScale * (0.8 + node.value * 0.5);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    onClick(node.id, e);
  }, [node.id, onClick]);

  const handlePointerOver = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  // Animation
  useFrame((state, delta) => {
    if (meshRef.current) {
      const currentScale = meshRef.current.scale.x;
      const scaleStep = delta * 3;
      
      if (Math.abs(currentScale - targetScale) > 0.01) {
        const newScale = THREE.MathUtils.lerp(currentScale, targetScale, scaleStep);
        meshRef.current.scale.set(newScale, newScale, newScale);
      }
    }
  });

  // Determine colors
  const nodeColor = useMemo(() => {
    if (dimmed) return '#666666';
    if (isSelected) return themeHex;
    if (isHighlighted) return '#ffaa00';
    return node.type === 'entity' ? '#4ade80' : '#fb7185';
  }, [dimmed, isSelected, isHighlighted, themeHex, node.type]);

  const emissiveColor = useMemo(() => {
    if (isSelected || hovered) return nodeColor;
    return '#000000';
  }, [isSelected, hovered, nodeColor]);

  // Calculate positions for labels and percentages
  const labelYOffset = targetScale + 1.2;
  const percentageYOffset = targetScale + 2.0;

  // Get translated text
  const displayText = useMemo(() => {
    if (isInstantMode && getInstantTranslation) {
      return getInstantTranslation(node.id);
    }
    return node.id;
  }, [isInstantMode, getInstantTranslation, node.id]);

  return (
    <group position={node.position}>
      {/* Node mesh */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        scale={[targetScale, targetScale, targetScale]}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhongMaterial
          color={nodeColor}
          emissive={emissiveColor}
          emissiveIntensity={isSelected || hovered ? 0.2 : 0}
          transparent
          opacity={dimmed ? 0.3 : 0.9}
        />
      </mesh>

      {/* Node label with translation tracking */}
      {showLabel && forceShowLabels && (
        <TranslatableText3D
          text={node.id}
          position={[0, labelYOffset, 0]}
          color={dimmed ? '#888888' : (effectiveTheme === 'dark' ? '#ffffff' : '#000000')}
          size={Math.max(0.3, Math.min(0.6, 0.4 * (45 / Math.max(cameraZoom, 20))))}
          visible={true}
          renderOrder={20}
          bold={isSelected}
          nodeId={nodeId || node.id} // Pass nodeId for tracking
        />
      )}

      {/* Connection percentage */}
      {showPercentage && connectionPercentage > 0 && (
        <Text
          position={[0, percentageYOffset, 0]}
          fontSize={Math.max(0.25, Math.min(0.45, 0.35 * (45 / Math.max(cameraZoom, 20))))}
          color={themeHex}
          anchorX="center"
          anchorY="middle"
          renderOrder={25}
          font="/fonts/helvetiker_regular.typeface.json"
        >
          {connectionPercentage}%
        </Text>
      )}
    </group>
  );
};

export default Node;
