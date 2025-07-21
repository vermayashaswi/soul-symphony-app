import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface NodeProps {
  node: {
    id: string;
    label: string;
    position: THREE.Vector3;
  };
  isSelected: boolean;
  onClick: () => void;
  isHighlighted: boolean;
  isDimmed: boolean;
  connectionPercentage: number;
  showPercentage: boolean;
  connectionStrength: number;
  showLabel: boolean;
  themeHex: string;
  cameraZoom: number;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  getCoordinatedTranslation?: (key: string) => string;
  animationStartTime?: number;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  isHighlighted,
  isDimmed,
  connectionPercentage,
  showPercentage,
  connectionStrength,
  showLabel,
  themeHex,
  cameraZoom,
  effectiveTheme = 'light',
  isInstantMode = false,
  getCoordinatedTranslation,
  animationStartTime = 0
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [animationTime, setAnimationTime] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);
  
  // Update animation time
  useFrame((state) => {
    if (isSelected && animationStartTime > 0) {
      const elapsed = Date.now() - animationStartTime;
      setAnimationTime(elapsed);
      setPulsePhase(elapsed * 0.005); // Adjust pulse speed
    } else {
      setAnimationTime(0);
      setPulsePhase(0);
    }
  });

  // Calculate node appearance
  const nodeAppearance = useMemo(() => {
    const baseSize = 0.3;
    const strengthMultiplier = 0.5 + (connectionStrength * 0.5);
    
    let size = baseSize * strengthMultiplier;
    let opacity = 1;
    let color = themeHex;
    
    if (isSelected) {
      // Selected node: larger and pulsating
      const pulseScale = 1 + Math.sin(pulsePhase) * 0.2;
      size *= 1.5 * pulseScale;
      
      // Deeper color for selected node
      const selectedColor = new THREE.Color(themeHex);
      selectedColor.multiplyScalar(1.2);
      color = `#${selectedColor.getHexString()}`;
      
      console.log('[Node] Selected node appearance:', {
        nodeId: node.id,
        size,
        pulseScale,
        pulsePhase,
        animationTime
      });
    } else if (isHighlighted) {
      // Highlighted connected nodes: slightly larger and brighter
      size *= 1.2;
      const highlightColor = new THREE.Color(themeHex);
      highlightColor.multiplyScalar(1.1);
      color = `#${highlightColor.getHexString()}`;
    } else if (isDimmed) {
      // Dimmed unconnected nodes: smaller and more transparent
      size *= 0.8;
      opacity = 0.3;
      const dimColor = new THREE.Color(themeHex);
      dimColor.multiplyScalar(0.7);
      color = `#${dimColor.getHexString()}`;
    }
    
    return { size, opacity, color };
  }, [isSelected, isHighlighted, isDimmed, connectionStrength, themeHex, pulsePhase, animationTime, node.id]);

  // Handle mesh updates
  useEffect(() => {
    if (meshRef.current) {
      const mesh = meshRef.current;
      
      // Update scale
      mesh.scale.setScalar(nodeAppearance.size / 0.3);
      
      // Update material
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.setHex(parseInt(nodeAppearance.color.replace('#', ''), 16));
        mesh.material.opacity = nodeAppearance.opacity;
        mesh.material.transparent = nodeAppearance.opacity < 1;
        mesh.material.needsUpdate = true;
      }
    }
  }, [nodeAppearance]);

  // Text configuration
  const textConfig = useMemo(() => {
    const baseSize = 0.12;
    const scaleFactor = Math.max(0.8, 1 / Math.sqrt(cameraZoom));
    const size = baseSize * scaleFactor;
    
    const shouldShowText = showLabel && (
      !isDimmed || 
      isSelected || 
      isHighlighted ||
      cameraZoom > 1.5
    );
    
    return {
      size,
      shouldShow: shouldShowText,
      yOffset: nodeAppearance.size + 0.2
    };
  }, [showLabel, isDimmed, isSelected, isHighlighted, cameraZoom, nodeAppearance.size]);

  return (
    <group position={node.position}>
      {/* Node mesh */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => console.log(`[Node] Hover: ${node.id}`)}
      >
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={nodeAppearance.color}
          opacity={nodeAppearance.opacity}
          transparent={nodeAppearance.opacity < 1}
        />
      </mesh>
      
      {/* Node label */}
      {textConfig.shouldShow && (
        <Text
          position={[0, textConfig.yOffset, 0]}
          fontSize={textConfig.size}
          color={effectiveTheme === 'light' ? '#374151' : '#e5e7eb'}
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-medium.woff"
          maxWidth={2}
          textAlign="center"
        >
          {getCoordinatedTranslation ? getCoordinatedTranslation(node.id) : node.label}
        </Text>
      )}
      
      {/* Connection percentage display */}
      {showPercentage && (
        <Text
          position={[0, -textConfig.yOffset, 0]}
          fontSize={textConfig.size * 0.8}
          color={connectionPercentage > 0.7 ? '#22c55e' : connectionPercentage > 0.4 ? '#f59e0b' : '#ef4444'}
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-medium.woff"
        >
          {Math.round(connectionPercentage * 100)}%
        </Text>
      )}
    </group>
  );
};

export default Node;
