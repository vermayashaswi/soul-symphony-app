
import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SmartTextRenderer from './SmartTextRenderer';
import { useUserColorThemeHex } from './useUserColorThemeHex';

interface OptimizedNodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
  precomputedConnections: {
    connectedNodes: Set<string>;
    connectionPercentages: Map<string, number>;
    connectionStrengths: Map<string, number>;
    totalConnections: number;
  };
  precomputedScale: number;
  precomputedOpacity: number;
}

interface OptimizedNodeProps {
  node: OptimizedNodeData;
  selectedNodeId: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  translatedText: string;
  cameraZoom: number;
  effectiveTheme: 'light' | 'dark';
}

const OptimizedNode: React.FC<OptimizedNodeProps> = ({
  node,
  selectedNodeId,
  onNodeClick,
  themeHex,
  translatedText,
  cameraZoom,
  effectiveTheme
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const userColorThemeHex = useUserColorThemeHex();

  // Pre-compute visual states based on selection
  const visualState = useMemo(() => {
    const isSelected = selectedNodeId === node.id;
    const isConnected = selectedNodeId ? node.precomputedConnections.connectedNodes.has(selectedNodeId) : false;
    const isHighlighted = isSelected || isConnected;
    const isDimmed = selectedNodeId !== null && !isHighlighted;

    // Get connection percentage if this node is connected to selected node
    const connectionPercentage = selectedNodeId && isConnected && !isSelected
      ? node.precomputedConnections.connectionPercentages.get(selectedNodeId) || 0
      : 0;

    return {
      isSelected,
      isConnected,
      isHighlighted,
      isDimmed,
      connectionPercentage,
      showPercentage: connectionPercentage > 0
    };
  }, [selectedNodeId, node.id, node.precomputedConnections]);

  // Pre-compute colors and scales for instant updates
  const renderProps = useMemo(() => {
    const { isSelected, isHighlighted, isDimmed } = visualState;

    let color: THREE.Color;
    let scale: number;
    let opacity: number;

    if (isSelected) {
      color = new THREE.Color('#ffffff');
      scale = node.precomputedScale * 1.6;
      opacity = 1.0;
    } else if (isHighlighted) {
      color = new THREE.Color(userColorThemeHex);
      scale = node.precomputedScale * 1.3;
      opacity = 0.9;
    } else if (isDimmed) {
      color = new THREE.Color('#3a3a3a');
      scale = node.precomputedScale * 0.6;
      opacity = 0.05;
    } else {
      color = new THREE.Color('#cccccc');
      scale = node.precomputedScale;
      opacity = node.precomputedOpacity;
    }

    return { color, scale, opacity };
  }, [visualState, node.precomputedScale, node.precomputedOpacity, userColorThemeHex]);

  // Optimized frame update with minimal computation
  useFrame(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      
      // Use direct assignment instead of lerp for instant updates
      material.color.copy(renderProps.color);
      material.opacity = renderProps.opacity;
      
      const scaleValue = renderProps.scale;
      meshRef.current.scale.set(scaleValue, scaleValue, scaleValue);
    }
  });

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    onNodeClick(node.id);
  }, [node.id, onNodeClick]);

  // Only show labels for non-dimmed nodes
  const shouldShowLabel = !visualState.isDimmed;

  console.log(`[OptimizedNode] INSTANT RENDER: ${node.id} - highlighted: ${visualState.isHighlighted}, dimmed: ${visualState.isDimmed}, percentage: ${visualState.connectionPercentage}%`);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={node.position}
        onClick={handleClick}
      >
        {node.type === 'emotion' ? (
          <boxGeometry args={[1.6, 1.6, 1.6]} />
        ) : (
          <sphereGeometry args={[0.8, 32, 32]} />
        )}
        <meshStandardMaterial 
          color={renderProps.color}
          metalness={0.3} 
          roughness={0.8}
          transparent={true}
          opacity={renderProps.opacity}
        />
      </mesh>
      
      {shouldShowLabel && (
        <SmartTextRenderer
          text={visualState.showPercentage ? `${translatedText}\n${visualState.connectionPercentage}%` : translatedText}
          position={[
            node.position[0],
            node.position[1] + (renderProps.scale * 1.2),
            node.position[2]
          ]}
          color={effectiveTheme === 'dark' ? '#ffffff' : '#000000'}
          size={visualState.isSelected ? 0.35 : 0.28}
          visible={true}
          renderOrder={15}
          bold={visualState.isSelected}
          enableWrapping={visualState.showPercentage}
          maxCharsPerLine={16}
          maxLines={2}
        />
      )}
    </group>
  );
};

export default OptimizedNode;
