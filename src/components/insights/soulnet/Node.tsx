import React, { useRef } from 'react';
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
  dimmed,
  themeHex,
  selectedNodeId,
  cameraZoom,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const { camera } = useThree();

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

  // Always show all labels
  const shouldShowLabel = true;

  let cameraZ = cameraZoom !== undefined 
    ? cameraZoom 
    : (camera && (camera as any).position ? (camera as any).position.z : 26);
  if (typeof cameraZ !== 'number' || Number.isNaN(cameraZ)) cameraZ = 26;

  // Increase base font size by 35%
  let dynamicFontSize = 12.825 + Math.max(0, (cameraZ - 18) * 0.8); // Increased from 9.45 to 12.825
  dynamicFontSize = Math.max(dynamicFontSize, 11.88); // Increased min from 8.8 to 11.88
  dynamicFontSize = Math.min(dynamicFontSize, 32.4);   // Increased max from 24 to 32.4

  const handleInteraction = (e: any) => {
    e.stopPropagation();
    // Immediate selection on any interaction
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
          distanceFactor={1}
          occlude={false}
          className="z-40"
          style={{
            transform: 'scale(1) !important',
            minWidth: 'auto',
            minHeight: 'auto',
            pointerEvents: 'none',
            fontSize: `${dynamicFontSize}rem`, // Increased font size by 35%
            fontWeight: 700,
            lineHeight: 1.1,
            zIndex: 99999,
            userSelect: 'text',
            whiteSpace: 'nowrap',
            textShadow: theme === 'dark'
              ? "0 2px 6px #000, 0px 0px 9px #000, 0px 0px 5px #000"
              : "0 2px 8px #fff, 0px 0px 7px #fff, 0px 0px 5px #fff"
          }}
        >
          <div className={`
            px-2 py-1 rounded-lg font-bold whitespace-nowrap
            ${theme === 'dark' ? 'bg-gray-800/90 text-white' : 'bg-white/90 text-gray-800'}
            ${isHighlighted ? 'scale-110 font-black' : 'opacity-95'}
            shadow-xl transition-all duration-200
            select-text
          `}>
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
};
