import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { animated, useSpring } from '@react-spring/three';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useR3FTranslations } from '../../hooks/useR3FTranslation';

interface Text3DProps {
  text: string;
  position: [number, number, number];
  size?: number;
  color?: string;
  isSelected?: boolean;
  isConnected?: boolean;
  isFaded?: boolean;
  percentage?: number;
  billboard?: boolean;
  maxWidth?: number;
  textAlign?: 'left' | 'center' | 'right';
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
}

export function Text3D({ 
  text, 
  position, 
  size = 0.3,
  color = '#ffffff',
  isSelected = false,
  isConnected = false,
  isFaded = false,
  percentage,
  billboard = true,
  maxWidth = 2,
  textAlign = 'center',
  anchorX = 'center',
  anchorY = 'middle'
}: Text3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Spring animations for smooth transitions
  const { scale, opacity } = useSpring({
    scale: isSelected || isConnected ? 1.2 : isFaded ? 0.7 : 1,
    opacity: isFaded ? 0.4 : 1,
    config: { tension: 300, friction: 30 }
  });

  // Determine text color based on state
  const textColor = useMemo(() => {
    if (isSelected) return '#ff6b6b';
    if (isConnected) return '#4ecdc4';
    if (isFaded) return '#666666';
    return color;
  }, [isSelected, isConnected, isFaded, color]);

  // Billboard effect - make text face camera
  useFrame(({ camera }) => {
    if (billboard && groupRef.current) {
      groupRef.current.lookAt(camera.position);
    }
  });

  // Gentle floating animation for selected/connected nodes
  useFrame((state) => {
    if ((isSelected || isConnected) && groupRef.current) {
      const time = state.clock.elapsedTime;
      const originalY = position[1];
      groupRef.current.position.y = originalY + Math.sin(time * 2) * 0.1;
    }
  });

  return (
    <animated.group 
      ref={groupRef}
      position={position}
      scale={scale}
    >
      <Text
        text={text}
        fontSize={size}
        maxWidth={maxWidth}
        lineHeight={1}
        letterSpacing={0}
        textAlign={textAlign}
        anchorX={anchorX}
        anchorY={anchorY}
        color={textColor}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        <animated.meshBasicMaterial 
          transparent
          opacity={opacity}
          color={textColor}
        />
      </Text>
      
      {/* Percentage label for selected/connected nodes */}
      {(isSelected || isConnected) && percentage !== undefined && (
        <Text
          position={[0, -0.5, 0]}
          text={`${percentage.toFixed(1)}%`}
          fontSize={size * 0.7}
          maxWidth={maxWidth * 0.8}
          textAlign={textAlign}
          anchorX={anchorX}
          anchorY="top"
          color="#ffd93d"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          <animated.meshBasicMaterial 
            transparent
            opacity={opacity}
            color="#ffd93d"
          />
        </Text>
      )}
    </animated.group>
  );
}

interface NodeLabels3DProps {
  nodes: Array<{
    id: string;
    label: string;
    position: [number, number, number];
    type: 'theme' | 'emotion';
    percentage?: number;
  }>;
  selectedNodeId: string | null;
  connectedNodeIds: Set<string>;
  cameraDistance?: number;
}

export function NodeLabels3D({ 
  nodes, 
  selectedNodeId, 
  connectedNodeIds,
  cameraDistance = 15
}: NodeLabels3DProps) {
  // Get all node labels for translation
  const nodeLabels = useMemo(() => nodes.map(node => node.label), [nodes]);
  const { translatedTexts } = useR3FTranslations(nodeLabels);

  // Calculate adaptive text size based on camera distance
  const textSize = useMemo(() => {
    const baseSize = 0.3;
    const scaleFactor = Math.max(0.5, Math.min(2, cameraDistance / 15));
    return baseSize * scaleFactor;
  }, [cameraDistance]);

  return (
    <group>
      {nodes.map((node, index) => {
        const isSelected = selectedNodeId === node.id;
        const isConnected = connectedNodeIds.has(node.id);
        const isFaded = selectedNodeId !== null && !isSelected && !isConnected;

        // Use translated text or fallback to original
        const translatedText = translatedTexts[index] || node.label;

        // Position label slightly above/below the node based on type
        const labelOffset: [number, number, number] = [
          0,
          node.type === 'theme' ? 1.2 : -1.2,
          0
        ];
        
        const labelPosition: [number, number, number] = [
          node.position[0] + labelOffset[0],
          node.position[1] + labelOffset[1],
          node.position[2] + labelOffset[2]
        ];

        return (
          <Text3D
            key={node.id}
            text={translatedText}
            position={labelPosition}
            size={textSize}
            isSelected={isSelected}
            isConnected={isConnected}
            isFaded={isFaded}
            percentage={node.percentage}
            billboard={true}
            maxWidth={3}
          />
        );
      })}
    </group>
  );
}

// Background panel for better text readability
export function TextBackground({ 
  position, 
  size = [2, 0.8], 
  opacity = 0.3,
  color = '#000000'
}: {
  position: [number, number, number];
  size?: [number, number];
  opacity?: number;
  color?: string;
}) {
  return (
    <mesh position={position}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshBasicMaterial 
        color={color}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}