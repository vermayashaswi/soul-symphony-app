import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useTheme } from '@/hooks/use-theme';
import { getOpenMojiUnicodeForEntity, getOpenMojiSvg } from "./entityEmojiUtils";

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
  showLabel,
  dimmed,
  themeHex,
  selectedNodeId,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { theme } = useTheme();
  const isHighlighted = isSelected || highlightedNodes.has(node.id);
  const baseScale = node.type === 'entity' ? 0.5 : 0.4;
  const scale = baseScale * (0.8 + node.value * 0.5);

  let emojiSvg: string | undefined = undefined;
  if (node.type === "entity") {
    const unicode = getOpenMojiUnicodeForEntity(node.id);
    emojiSvg = getOpenMojiSvg(unicode);
  }

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

  // All emotion/entity labels must be visible if no selection.
  const shouldShowLabel =
    showLabel && (
      !selectedNodeId // all labels when nothing selected
      || node.id === selectedNodeId
      || highlightedNodes.has(node.id)
      || node.type === 'emotion'
      // ensures emotion always visible
      // fallback for all non-dimmed nodes
    );

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
        {emojiSvg && node.type === "entity" && (
          <Html
            position={[0, 0, 1.35]}
            center
            distanceFactor={9}
            occlude
          >
            <div
              className="emoji-entity-node"
              style={{
                width: 42,
                height: 42,
                pointerEvents: "none",
                userSelect: "none",
                filter: dimmed ? "grayscale(0.7) opacity(0.5)" : "",
              }}
              dangerouslySetInnerHTML={{ __html: emojiSvg }}
            />
          </Html>
        )}
      </mesh>
      {shouldShowLabel && (
        <Html
          position={[0, node.type === 'entity' ? 1.2 : 1.4, 0]}
          center
          distanceFactor={15}
          occlude
        >
          <div className={`
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
            ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
            ${isHighlighted ? 'scale-110 font-bold' : 'opacity-90'}
            shadow transition-all duration-200
          `}>
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
};
