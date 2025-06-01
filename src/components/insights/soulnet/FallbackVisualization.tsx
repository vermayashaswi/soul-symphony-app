
import React from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface FallbackVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
}

export const FallbackVisualization: React.FC<FallbackVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex
}) => {
  console.log('[FallbackVisualization] Rendering fallback mode');

  if (!data || !data.nodes || data.nodes.length === 0) {
    return null;
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        minDistance={10}
        maxDistance={60}
      />

      {/* Render simple spheres for all nodes */}
      {data.nodes.map((node) => {
        if (!node || !Array.isArray(node.position)) {
          return null;
        }

        const isSelected = selectedNode === node.id;
        const baseScale = node.type === 'entity' ? 0.8 : 0.6;
        const scale = isSelected ? baseScale * 1.5 : baseScale;
        const color = isSelected ? '#ffffff' : themeHex;

        return (
          <mesh
            key={`fallback-${node.id}`}
            position={node.position}
            scale={[scale, scale, scale]}
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick(node.id);
            }}
          >
            <sphereGeometry args={[1, 16, 16]} />
            <meshPhongMaterial 
              color={color}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}

      {/* Render simple lines for connections */}
      {data.links.map((link, index) => {
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        
        if (!sourceNode || !targetNode) {
          return null;
        }

        const points = [
          new THREE.Vector3(...sourceNode.position),
          new THREE.Vector3(...targetNode.position)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          <line key={`fallback-line-${index}`}>
            <bufferGeometry attach="geometry" {...geometry} />
            <lineBasicMaterial 
              attach="material" 
              color={themeHex}
              opacity={0.3}
              transparent
            />
          </line>
        );
      })}
    </>
  );
};

export default FallbackVisualization;
