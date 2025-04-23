
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
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
  // Use memo for stable colors to avoid unnecessary re-renders
  const isHighlighted = isSelected || highlightedNodes.has(node.id);
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
  const scale = baseScale * (0.8 + node.value * 0.5);

  // Memoize colors to avoid recalculations causing flickering
  const displayColor = useMemo(() => 
    node.type === 'entity'
      ? (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : '#fff')
      : (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : themeHex),
    [node.type, dimmed, theme, themeHex]
  );

  const Geometry = useMemo(() => 
    node.type === 'entity'
      ? <sphereGeometry args={[1, 32, 32]} />
      : <boxGeometry args={[1.2, 1.2, 1.2]} />,
    [node.type]
  );

  // Animation for highlighted nodes with reduced frequency of updates
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    if (isHighlighted && !dimmed) {
      // Use slower animation frequency to reduce updates
      const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.08 + 1;
      meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
      
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        // Less frequent emissive changes
        meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.15;
      }
    } else if (meshRef.current.scale.x !== scale) {
      // Only update if scale has changed to reduce unnecessary render cycles
      meshRef.current.scale.set(scale, scale, scale);
      
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.emissiveIntensity = 0;
      }
    }
  });

  // Only show labels for highlighted nodes or when no node is selected
  const shouldShowLabel = showLabel && (!selectedNodeId || isHighlighted);

  // Calculate appropriate font size based on camera zoom with caching
  const cameraZ = useMemo(() => {
    let z = cameraZoom !== undefined 
      ? cameraZoom 
      : (camera && (camera as any).position ? (camera as any).position.z : 26);
    if (typeof z !== 'number' || Number.isNaN(z)) z = 26;
    return z;
  }, [camera, cameraZoom]);

  // Stabilize font size calculations to avoid frequent changes
  const dynamicFontSize = useMemo(() => {
    const base = 12.825 + Math.max(0, (cameraZ - 18) * 0.8);
    // Round to fewer decimal places to reduce unnecessary updates
    const size = Math.round(Math.max(Math.min(base, 32.4), 11.88) * 100) / 100;
    return size;
  }, [cameraZ]);

  // Improved touch handling with debouncing
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

  // Memoize the HTML label style to avoid recreating it on every render
  const labelStyle = useMemo(() => ({
    transform: 'scale(1) !important',
    minWidth: 'auto',
    minHeight: 'auto',
    pointerEvents: 'none' as const, // Fix: Cast to specific React type
    fontSize: `${dynamicFontSize}rem`,
    fontWeight: 700, 
    lineHeight: 1.1,
    zIndex: 99999,
    userSelect: 'text' as const, // Fix: Cast to specific React type
    whiteSpace: 'nowrap' as const, // Fix: Cast to specific React type
    // Use transform for smoother animation, avoid opacity
    transition: 'transform 0.2s ease-out',
    willChange: 'transform', // Hint to browser to optimize animations
    opacity: shouldShowLabel ? 1 : 0,
  }), [dynamicFontSize, shouldShowLabel]);

  // Memoize the label container style to avoid recreating it on every render
  const labelContainerStyle = useMemo(() => ({
    color: node.type === 'entity' ? '#fff' : themeHex,
    backgroundColor: node.type === 'entity' ? 'rgba(0, 0, 0, 0.85)' : 'white',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  }), [node.type, themeHex]);

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
          // Increase the distance factor to improve stability
          distanceFactor={1.2}
          // Disable occlusion to prevent flickering when nodes overlap
          occlude={false}
          // Important for z-order
          className="z-40"
          // Use transform3d for hardware acceleration
          style={labelStyle}
          // Add key based on node id to help React stabilize rendering
          key={`label-${node.id}-${isHighlighted ? 'highlighted' : 'normal'}`}
          // Fix: Properly type the calculatePosition function to match expected type
          calculatePosition={(el: any, camera: any, size: any) => true}
        >
          <div className={`
            px-2 py-1 rounded-lg font-bold whitespace-nowrap
            ${isHighlighted ? 'scale-110 font-black' : 'opacity-95'}
            select-text
          `}
            style={labelContainerStyle}
          >
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
};
