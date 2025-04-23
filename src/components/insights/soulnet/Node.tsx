
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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
}

export const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  // showLabel, // UNUSED – unconditional label display
  dimmed,
  themeHex,
  selectedNodeId,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const isHighlighted = isSelected || highlightedNodes.has(node.id);
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
  const scale = baseScale * (0.8 + node.value * 0.5);

  let displayColor = node.type === 'entity'
    ? (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : '#fff')
    : (dimmed ? (theme === 'dark' ? '#8E9196' : '#bbb') : themeHex);

  const Geometry = node.type === 'entity'
    ? <sphereGeometry args={[1, 32, 32]} />
    : <boxGeometry args={[1.2, 1.2, 1.2]} />;

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

  // All labels must always be visible at fixed size in any viewport, any selection.
  const shouldShowLabel = true;

  // Combined handler for all pointer/touch events
  const handleInteraction = (e: any) => {
    e.stopPropagation();
    onClick(node.id);
  };

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        scale={[scale, scale, scale]}
        onClick={handleInteraction}
        onPointerDown={handleInteraction}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerOver={(e) => e.stopPropagation()}
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
          distanceFactor={1} // Keep constant size regardless of camera/distance!
          occlude={false} // Never occlude labels
          className="z-40"
          style={{
            // NEVER scale label with 3D. Always render at constant screen size.
            // (tailwind below can be overridden by this style)
            transform: 'scale(1) !important',
            minWidth: 'auto',
            minHeight: 'auto',
            pointerEvents: 'none', // Prevents 3D events interference.
            fontSize: '1.06rem', // Fixed readable size
            fontWeight: 500,
            lineHeight: 1.1,
            zIndex: 99999,
            userSelect: 'text',
            // Add more styles for akways-legible rendering if required:
            whiteSpace: 'nowrap',
            textShadow: theme === 'dark'
              ? "0 2px 6px #000, 0px 0px 9px #000"
              : "0 2px 8px #fff, 0px 0px 7px #fff"
          }}
        >
          <div className={`
            px-2 py-1 rounded-md font-medium whitespace-nowrap
            ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
            ${isHighlighted ? 'scale-110 font-bold' : 'opacity-90'}
            shadow transition-all duration-200
            select-text
          `}>
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
};
