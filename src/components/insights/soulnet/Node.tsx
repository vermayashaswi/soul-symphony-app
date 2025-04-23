import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useTheme } from '@/hooks/use-theme';
import { getTwemojiUrlForEntity } from "./entityEmojiUtils";

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
  const baseScale = node.type === 'emotion' ? 0.4 : 0.6;
  const scale = baseScale * (0.8 + node.value * 0.5);

  // All entity nodes: render ONLY emoji via Twemoji (no mesh sphere at all!)
  // All emotion nodes: keep original 3D mesh (cube) with color.

  // Only define mesh/material for emotion nodes
  const Geometry = node.type === 'emotion'
    ? <boxGeometry args={[1.2, 1.2, 1.2]} />
    : null;

  useFrame(({ clock }) => {
    if (node.type !== "emotion") return; // Only emotion nodes animate mesh
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
      !selectedNodeId 
      || node.id === selectedNodeId
      || highlightedNodes.has(node.id)
      || node.type === 'emotion'
    );

  // Unified click handler
  const handleInteraction = (e: any) => {
    e.stopPropagation();
    onClick(node.id);
  };

  return (
    <group position={node.position}>
      {node.type === "entity" ? (
        <Html
          center
          position={[0, 0, 0]}
          distanceFactor={5}
          occlude
        >
          <img
            src={getTwemojiUrlForEntity(node.id)}
            alt={node.id}
            draggable={false}
            style={{
              width: 220,
              height: 220,
              filter: dimmed ? "grayscale(0.7) opacity(0.5)" : "",
              transform: isHighlighted ? "scale(1.2)" : "scale(1.00)",
              pointerEvents: "auto",
              userSelect: "none",
              cursor: "pointer",
              transition: "transform 0.15s, filter 0.15s",
              boxShadow: isHighlighted ? (theme === "dark" ? "0 0 30px #fff5" : "0 0 30px #0003") : "",
              zIndex: isHighlighted ? 5 : 1,
              borderRadius: "50%",
              border: isHighlighted ? "5px solid #60a5fa" : "none",
              background: "transparent",
            }}
            onClick={handleInteraction}
            onPointerDown={handleInteraction}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerOver={(e) => e.stopPropagation()}
            loading="lazy"
          />
        </Html>
      ) : (
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
            color={themeHex}
            transparent
            opacity={isHighlighted ? 1 : 0.7}
            emissive={themeHex}
            emissiveIntensity={isHighlighted && !dimmed ? 0.5 : 0}
          />
        </mesh>
      )}
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
