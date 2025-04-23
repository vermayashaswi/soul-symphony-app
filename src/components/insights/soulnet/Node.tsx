
import React, { useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useTheme } from '@/hooks/use-theme';

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
  onClick: (id: string) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom?: number;
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
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const { camera } = useThree();
  const [isTouching, setIsTouching] = useState(false);

  const isHighlighted = isSelected || highlightedNodes.has(node.id);
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
  const scale = baseScale * (0.8 + node.value * 0.5);

  // Determine color based on type and state
  let displayColor = node.type === 'entity'
    ? (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : '#fff')
    : (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : themeHex);

  const Geometry = node.type === 'entity'
    ? <sphereGeometry args={[1, 32, 32]} />
    : <boxGeometry args={[1.2, 1.2, 1.2]} />;

  // Animation for highlighted nodes
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isHighlighted && !dimmed) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.1 + 1;
      meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 5) * 0.2;
      }
    } else {
      meshRef.current.scale.set(scale, scale, scale);
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.emissiveIntensity = 0;
      }
    }
  });

  // Only show labels for highlighted nodes or when no node is selected
  const shouldShowLabel = showLabel && (!selectedNodeId || isHighlighted);

  // Calculate appropriate font size based on camera zoom
  let cameraZ = cameraZoom !== undefined 
    ? cameraZoom 
    : (camera && (camera as any).position ? (camera as any).position.z : 26);
  if (typeof cameraZ !== 'number' || Number.isNaN(cameraZ)) cameraZ = 26;

  let dynamicFontSize = 12.825 + Math.max(0, (cameraZ - 18) * 0.8);
  dynamicFontSize = Math.max(dynamicFontSize, 11.88);
  dynamicFontSize = Math.min(dynamicFontSize, 32.4);

  // Improved touch handling with timers to ensure selection happens
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setIsTouching(true);
    setTouchStartTime(Date.now());
    
    // Immediately select on pointer down for better responsiveness
    onClick(node.id);
  }, [node.id, onClick]);

  const handlePointerUp = useCallback((e: any) => {
    e.stopPropagation();
    setIsTouching(false);
    setTouchStartTime(null);
  }, []);

  // This ensures selection persists even with light touches
  useEffect(() => {
    if (isTouching && touchStartTime) {
      const timer = setTimeout(() => {
        if (isTouching) {
          onClick(node.id); // Ensure selection happens
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isTouching, touchStartTime, node.id, onClick]);

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        scale={[scale, scale, scale]}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={() => setIsTouching(false)}
        onPointerLeave={() => setIsTouching(false)}
      >
        {Geometry}
        <meshStandardMaterial
          color={displayColor}
          transparent
          opacity={isHighlighted ? 1 : 0.7}
          emissive={displayColor}
          emissiveIntensity={isHighlighted && !dimmed ? 0.5 : 0}
        />
      </mesh>
      {shouldShowLabel && (
        <Html
          position={[0, node.type === 'entity' ? 1.2 : 1.4, 0]}
          center
          distanceFactor={1}
          occlude={false}
          className="z-40"
          style={{
            transform: 'scale(1) !important',
            minWidth: 'auto',
            minHeight: 'auto',
            pointerEvents: 'none',
            fontSize: `${dynamicFontSize}rem`,
            fontWeight: 700,
            lineHeight: 1.1,
            zIndex: 99999,
            userSelect: 'text',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.2s ease', // Smoother transitions
            opacity: shouldShowLabel ? 1 : 0,
          }}
        >
          <div className={`
            px-2 py-1 rounded-lg font-bold whitespace-nowrap
            ${isHighlighted ? 'scale-110 font-black' : 'opacity-95'}
            select-text
          `}
            style={{
              color: node.type === 'entity' ? '#fff' : themeHex,
              backgroundColor: node.type === 'entity' ? 'rgba(0, 0, 0, 0.85)' : 'white',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
          >
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
};
