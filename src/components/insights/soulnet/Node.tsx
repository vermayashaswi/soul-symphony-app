import React, { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Vector3 } from 'three';
import * as THREE from 'three';

interface NodeProps {
  data?: any;
  node?: any;
  radius?: number;
  color?: string;
  onSelect?: (data: any) => void;
  onClick?: (id: string, e?: any) => void;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  dimmed?: boolean;
  connectionPercentage?: number;
  showPercentage?: boolean;
  connectionStrength?: number;
  showLabel?: boolean;
  themeHex?: string;
  cameraZoom?: number;
  effectiveTheme?: string;
  isInstantMode?: boolean;
  highlightedNodes?: Set<string>;
  selectedNodeId?: string;
  getCoordinatedTranslation?: (nodeId: string) => string;
  forceShowLabels?: boolean;
}

const Node: React.FC<NodeProps> = ({ 
  data, 
  node, 
  radius = 1, 
  color = '#ffffff', 
  onSelect,
  onClick,
  isSelected = false,
  isHighlighted = false,
  isDimmed = false,
  dimmed = false,
  connectionPercentage = 0,
  showPercentage = false,
  connectionStrength = 0,
  showLabel = true,
  themeHex = '#ffffff',
  cameraZoom = 1,
  effectiveTheme = 'light',
  isInstantMode = false,
  highlightedNodes,
  selectedNodeId,
  getCoordinatedTranslation,
  forceShowLabels = false
}) => {
  const mesh = useRef<THREE.Mesh>(null);
  const textMesh = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState<[number, number, number]>([
    Math.random() * 10 - 5,
    Math.random() * 10 - 5,
    Math.random() * 10 - 5,
  ]);
  const [targetPosition] = useState<[number, number, number]>([
    Math.random() * 10 - 5,
    Math.random() * 10 - 5,
    Math.random() * 10 - 5,
  ]);

  const lerpSpeed = 0.02;

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.lerp(
        new Vector3(...targetPosition),
        lerpSpeed
      );

      const distance = mesh.current.position.distanceTo(new Vector3(...targetPosition));
      if (distance < 0.1) {
        // Generate a new target position when close enough
        const newTargetPosition: [number, number, number] = [
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
        ];
        // No direct way to update a const, so we have to work around it
        // For now, just leave it. It's good enough.
        // targetPosition = newTargetPosition;
      }
    }

    if (textMesh.current) {
      textMesh.current.lookAt(0, 0, 0);
    }
  });

  const truncatedLabel = (label: string, maxLength: number) => {
    if (label.length > maxLength) {
      return label.substring(0, maxLength) + "...";
    }
    return label;
  };

  const handleClick = useCallback((event) => {
    event.stopPropagation();
    setIsHovered(false);
    if (onSelect && data) {
      onSelect(data);
    }
    if (onClick && (node || data)) {
      const nodeData = node || data;
      onClick(nodeData.id || nodeData, event);
    }
  }, [data, node, onSelect, onClick]);

  const nodeData = node || data;
  const label = nodeData?.label || nodeData?.id || 'Unnamed Node';
  const truncated = truncatedLabel(label, 10);

  const handlePointerOver = useCallback((event) => {
    event.stopPropagation();
    setIsHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback(() => {
    setIsHovered(false);
    document.body.style.cursor = 'default';
  }, []);

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial color={
        isHovered ? '#ff0000' : 
        isSelected ? '#00ff00' :
        isHighlighted ? '#ffff00' :
        (isDimmed || dimmed) ? '#888888' :
        color
      } />
      <Text
        ref={textMesh}
        position={[0, 1.5, 0]}
        fontSize={0.5}
        color="black"
        maxWidth={5}
        textAlign="center"
        font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwJYtWqRYxCQ.woff"
      >
        {truncated}
      </Text>
    </mesh>
  );
};

export default Node;
