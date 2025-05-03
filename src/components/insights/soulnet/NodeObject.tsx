
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import NodeLabel from './NodeLabel';
import ConnectionPercentage from './ConnectionPercentage';

interface NodeObjectProps {
  id: string;
  position: [number, number, number];
  color: string;
  size: number;
  type: 'entity' | 'emotion' | 'connection';
  isHighlighted?: boolean;
  isSelected?: boolean;
  isHidden?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
  cameraZoom?: number;
  themeHex?: string;
  percentage?: number;
  nodeType?: 'entity' | 'emotion';
  translatedText?: string;
}

const NodeObject: React.FC<NodeObjectProps> = ({
  id,
  position,
  color,
  size,
  type,
  isHighlighted = false,
  isSelected = false,
  isHidden = false,
  showLabel = true,
  onClick,
  cameraZoom,
  themeHex = '#42a5f5',
  percentage,
  nodeType = 'emotion',
  translatedText
}) => {
  // Create a reference to the mesh
  const meshRef = React.useRef<THREE.Mesh>(null);
  const pulseRef = React.useRef(0);
  const materialRef = React.useRef<THREE.Material | null>(null);
  const originalSize = React.useRef(size);
  
  // Set up pulsing animation for highlighted nodes
  useFrame(() => {
    if (!meshRef.current || isHidden) return;

    // Get the material
    if (!materialRef.current && meshRef.current.material) {
      materialRef.current = Array.isArray(meshRef.current.material)
        ? meshRef.current.material[0]
        : meshRef.current.material;
    }

    // Add subtle pulse animation to highlighted nodes
    if (isHighlighted) {
      pulseRef.current += 0.07;
      const scale = 1 + Math.sin(pulseRef.current) * 0.05;
      meshRef.current.scale.set(scale, scale, scale);
      
      // Increase opacity for highlighted nodes
      if (materialRef.current && 'opacity' in materialRef.current) {
        materialRef.current.opacity = Math.min(1.0, 0.8 + Math.sin(pulseRef.current) * 0.2);
      }
    } else {
      // Reset animation state if not highlighted
      if (pulseRef.current !== 0) {
        pulseRef.current = 0;
        meshRef.current.scale.set(1, 1, 1);
        
        if (materialRef.current && 'opacity' in materialRef.current) {
          materialRef.current.opacity = 0.7;
        }
      }
    }
  });

  // Skip rendering for hidden nodes or connection points
  if (isHidden || type === 'connection') {
    // For connection points, we only show percentage labels
    if (type === 'connection' && percentage !== undefined) {
      return (
        <ConnectionPercentage
          position={position}
          percentage={percentage}
          isVisible={true}
          nodeType={nodeType}
        />
      );
    }
    return null;
  }

  // Get the appropriate geometry based on node type
  const getGeometry = () => {
    if (type === 'entity') {
      return <sphereGeometry args={[size, 16, 16]} />;
    }
    return <sphereGeometry args={[size, 16, 16]} />;
  };

  // Apply color and opacity based on node state
  const getMaterial = () => {
    const baseOpacity = isHighlighted ? 0.9 : 0.7;
    
    return (
      <meshPhongMaterial
        color={color}
        transparent={true}
        opacity={baseOpacity}
        emissive={isHighlighted ? color : undefined}
        emissiveIntensity={isHighlighted ? 0.3 : 0}
        shininess={isHighlighted ? 80 : 50}
      />
    );
  };

  // Render the node with its label if needed
  return (
    <group position={position}>
      {/* The node itself */}
      <mesh
        ref={meshRef}
        onClick={onClick ? (e) => {
          e.stopPropagation();
          onClick();
        } : undefined}
        visible={!isHidden}
      >
        {getGeometry()}
        {getMaterial()}
      </mesh>
      
      {/* Node label */}
      {showLabel && (
        <NodeLabel
          id={id}
          type={type}
          position={[0, 0, 0]}
          isHighlighted={isHighlighted}
          shouldShowLabel={showLabel}
          cameraZoom={cameraZoom}
          themeHex={themeHex}
          translatedText={translatedText}
        />
      )}
      
      {/* Selection indicator for the selected node */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[size * 1.3, size * 1.5, 32]} />
          <meshBasicMaterial color={type === 'entity' ? '#ffffff' : themeHex} transparent opacity={0.4} />
        </mesh>
      )}
      
      {/* Interactive cursor indicator */}
      {onClick && (
        <Html>
          <div 
            style={{
              position: 'absolute',
              transform: 'translate(-50%, -50%)',
              width: `${size * 50}px`,
              height: `${size * 50}px`,
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          />
        </Html>
      )}
    </group>
  );
};

export default NodeObject;
