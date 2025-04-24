import React, { useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { ConnectionPercentage } from './ConnectionPercentage';
import NodeLabel from './NodeLabel';

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

interface SoulNetVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
}

interface EdgeProps {
  link: LinkData;
  nodes: NodeData[];
  scale: number;
  selectedNode: string | null;
  children: React.ReactNode;
}

const Edge: React.FC<EdgeProps> = ({ link, nodes, scale, selectedNode, children }) => {
  const sourceNode = useMemo(() => nodes.find(node => node.id === link.source), [link.source, nodes]);
  const targetNode = useMemo(() => nodes.find(node => node.id === link.target), [link.target, nodes]);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const start = new Vector3(...sourceNode.position);
  const end = new Vector3(...targetNode.position);
  const mid = start.clone().lerp(end, 0.5);
  const midLength = start.distanceTo(end) / 2;

  const normal = new Vector3().subVectors(end, start).normalize();
  const rotatedNormal = new Vector3(-normal.z, normal.y, normal.x).normalize();
  mid.addScaledVector(rotatedNormal, midLength * 0.03 * scale);

  const direction = new THREE.QuadraticBezierCurve3(start, mid, end);
  const points = direction.getPoints(50);
  const curveGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  const isHighlighted = selectedNode !== null && (selectedNode === link.source || selectedNode === link.target);
  const color = isHighlighted ? 'white' : 'rgba(255, 255, 255, 0.2)';
  const lineWidth = isHighlighted ? 3 : 1;

  return (
    <group>
      <primitive object={new THREE.Line(curveGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))} />
      {children}
    </group>
  );
};

const SoulNetVisualization = ({ data, selectedNode, onNodeClick, themeHex }: SoulNetVisualizationProps) => {
  const camera = useThree((state) => state.camera);
  const isNodeHighlighted = useCallback((nodeId: string) => selectedNode === nodeId, [selectedNode]);
  const shouldShowLabel = useCallback((nodeId: string) => {
    if (!selectedNode) return true;
    return selectedNode === nodeId;
  }, [selectedNode]);

  useFrame(() => {
    // console.log("Camera Z Position:", camera.position.z);
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[0, 10, 0]} intensity={0.4} />
      
      {data.links.map((link) => (
        <Edge
          key={`${link.source}-${link.target}`}
          link={link}
          nodes={data.nodes}
          scale={1}
          selectedNode={selectedNode}
        >
          <ConnectionPercentage
            position={[0, 0, 0]}
            percentage={link.value * 100}
            isVisible={selectedNode !== null && (selectedNode === link.source || selectedNode === link.target)}
            nodeType={data.nodes.find(n => n.id === (selectedNode === link.source ? link.target : link.source))?.type}
            cameraZoom={camera.position.z}
          />
        </Edge>
      ))}

      {data.nodes.map((node) => (
        <mesh
          key={node.id}
          position={node.position}
          onClick={() => onNodeClick(node.id)}
        >
          <sphereGeometry args={[node.type === 'entity' ? 0.6 : 0.4, 32, 32]} />
          <meshStandardMaterial
            color={node.color}
            emissive={isNodeHighlighted(node.id) ? themeHex : '#000'}
            emissiveIntensity={isNodeHighlighted(node.id) ? 0.6 : 0.1}
            metalness={0.3}
            roughness={0.8}
          />
          <NodeLabel
            id={node.id}
            type={node.type}
            position={node.position}
            isHighlighted={isNodeHighlighted(node.id)}
            shouldShowLabel={shouldShowLabel(node.id)}
            cameraZoom={camera.position.z}
            themeHex={themeHex}
          />
        </mesh>
      ))}
    </>
  );
};

export default SoulNetVisualization;
