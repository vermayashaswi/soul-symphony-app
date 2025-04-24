
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
  // Increased scale differential between highlighted and normal nodes
  const scale = isHighlighted 
    ? baseScale * (1.2 + node.value * 0.5) 
    : baseScale * (0.8 + node.value * 0.5);

  // Memoize colors to avoid recalculations causing flickering
  const displayColor = useMemo(() => {
    if (isHighlighted) {
      // Brighter colors for highlighted nodes
      return node.type === 'entity' ? '#ffffff' : themeHex;
    }
    return node.type === 'entity'
      ? (dimmed ? (theme === 'dark' ? '#555' : '#999') : '#ccc') 
      : (dimmed ? (theme === 'dark' ? '#555' : '#999') : themeHex);
  }, [node.type, dimmed, theme, themeHex, isHighlighted]);

  const Geometry = useMemo(() => 
    node.type === 'entity'
      ? <sphereGeometry args={[1, 32, 32]} />
      : <boxGeometry args={[1.2, 1.2, 1.2]} />,
    [node.type]
  );

  // Enhanced animation for highlighted nodes
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    if (isHighlighted) {
      // More pronounced pulse effect for highlighted nodes
      const pulse = Math.sin(clock.getElapsedTime() * 2.5) * 0.2 + 1.1;
      meshRef.current.scale.set(scale * pulse, scale * pulse, scale * pulse);
      
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        // Stronger emissive effect for better visibility
        meshRef.current.material.emissiveIntensity = 0.9 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
      }
    } else {
      // Only update if scale has changed to reduce unnecessary render cycles
      const targetScale = dimmed ? scale * 0.8 : scale; 
      meshRef.current.scale.set(targetScale, targetScale, targetScale);
      
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        // Dimmed nodes should have no emissive
        meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
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
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setIsTouching(true);
    setTouchStartTime(Date.now());
    setTouchStartPosition({x: e.clientX, y: e.clientY});
  }, []);

  const handlePointerUp = useCallback((e: any) => {
    e.stopPropagation();
    
    // Only trigger click if the touch was short (to differentiate from dragging)
    if (touchStartTime && Date.now() - touchStartTime < 300) {
      if (touchStartPosition) {
        // Check if it was a genuine tap/click, not a drag
        const deltaX = Math.abs(e.clientX - touchStartPosition.x);
        const deltaY = Math.abs(e.clientY - touchStartPosition.y);
        
        if (deltaX < 10 && deltaY < 10) { // Small threshold to detect real clicks vs drags
          onClick(node.id);
          
          // Add haptic feedback for mobile devices if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      } else {
        onClick(node.id);
      }
    }
    
    setIsTouching(false);
    setTouchStartTime(null);
    setTouchStartPosition(null);
  }, [node.id, onClick, touchStartTime, touchStartPosition]);

  // Ensure node selection works reliably across devices
  useEffect(() => {
    // Handle case where pointer up event might not be captured
    if (isTouching && touchStartTime) {
      const timer = setTimeout(() => {
        if (isTouching) {
          setIsTouching(false);
          setTouchStartTime(null);
          setTouchStartPosition(null);
        }
      }, 1000); // Safety timeout
      
      return () => clearTimeout(timer);
    }
  }, [isTouching, touchStartTime]);

  // Memoize the HTML label style to avoid recreating it on every render
  const labelStyle = useMemo(() => ({
    transform: isHighlighted ? 'scale(1.1) !important' : 'scale(1) !important',
    minWidth: 'auto',
    minHeight: 'auto',
    pointerEvents: 'none' as const, // Cast to specific React type
    fontSize: `${dynamicFontSize}rem`,
    fontWeight: isHighlighted ? 800 : 700, 
    lineHeight: 1.1,
    zIndex: isHighlighted ? 100000 : 99999,
    userSelect: 'text' as const, // Cast to specific React type
    whiteSpace: 'nowrap' as const, // Cast to specific React type
    // Use transform for smoother animation, avoid opacity
    transition: 'transform 0.2s ease-out, font-weight 0.2s ease',
    willChange: 'transform', // Hint to browser to optimize animations
    opacity: shouldShowLabel ? 1 : 0,
  }), [dynamicFontSize, shouldShowLabel, isHighlighted]);

  // Memoize the label container style to avoid recreating it on every render
  const labelContainerStyle = useMemo(() => ({
    color: node.type === 'entity' ? '#fff' : themeHex,
    backgroundColor: node.type === 'entity' ? 'rgba(0, 0, 0, 0.85)' : 'white',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: isHighlighted ? '0 2px 12px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
    padding: isHighlighted ? '0.4rem 0.8rem' : '0.2rem 0.5rem',
    borderRadius: '0.5rem',
    transition: 'all 0.2s ease',
  }), [node.type, themeHex, isHighlighted]);

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
          opacity={isHighlighted ? 1 : (dimmed ? 0.5 : 0.8)}
          emissive={displayColor}
          emissiveIntensity={isHighlighted ? 0.9 : (dimmed ? 0 : 0.1)}
          roughness={0.3}
          metalness={0.4}
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
        >
          <div className={`
            rounded-lg font-bold whitespace-nowrap
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
