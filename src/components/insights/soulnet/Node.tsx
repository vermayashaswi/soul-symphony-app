
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';

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
  onClick: (id: string, event: any) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom: number;
  isHighlighted: boolean;
  connectionPercentage?: number;
  showPercentage?: boolean;
  forceShowLabels?: boolean;
  translatedText?: string;
  effectiveTheme?: 'light' | 'dark';
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  highlightedNodes,
  showLabel,
  dimmed,
  themeHex,
  selectedNodeId,
  cameraZoom,
  isHighlighted,
  connectionPercentage = 0,
  showPercentage = false,
  forceShowLabels = false,
  translatedText,
  effectiveTheme = 'light'
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // FIXED: Enhanced color logic to apply same rules regardless of which node type is selected
  const color = useMemo(() => {
    if (isSelected) return new THREE.Color('#ffffff');
    
    if (isHighlighted) {
      // When highlighted (connected to selected node), apply color based on THIS node's type
      if (node.type === 'entity') {
        return new THREE.Color('#ffffff'); // Entity nodes are white when highlighted
      } else {
        return new THREE.Color(themeHex); // Emotion nodes use theme color when highlighted
      }
    }
    
    return new THREE.Color(dimmed ? '#666666' : '#cccccc');
  }, [isSelected, isHighlighted, node.type, themeHex, dimmed]);

  const nodeScale = useMemo(() => {
    if (isSelected) return 1.4;
    if (isHighlighted) return 1.2;
    return 1;
  }, [isSelected, isHighlighted]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.material.color.lerp(color, 0.1);
      meshRef.current.scale.lerp(new THREE.Vector3(nodeScale, nodeScale, nodeScale), 0.1);
    }
  });

  const handleNodeClick = (e: any) => {
    e.stopPropagation();
    onClick(node.id, e);
  };

  const shouldShowLabel = useMemo(() => {
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted]);

  // ENHANCED: Better logging for percentage tracking with comprehensive debug info
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[Node] FIXED: ${node.id} (${node.type}) should display percentage: ${connectionPercentage}% (isHighlighted: ${isHighlighted}, isSelected: ${isSelected})`);
  }

  console.log(`[Node] FIXED: Rendering ${node.type} node ${node.id} with translated text: "${translatedText || node.id}" and percentage display: ${showPercentage ? connectionPercentage + '%' : 'none'}`);

  // Render different geometries based on node type
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      // Use cube geometry for emotion nodes
      return <boxGeometry args={[1.4, 1.4, 1.4]} />;
    } else {
      // Keep sphere geometry for entity nodes
      return <sphereGeometry args={[0.7, 32, 32]} />;
    }
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        position={node.position}
        onClick={handleNodeClick}
      >
        {renderGeometry()}
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.8} />
      </mesh>
      
      {shouldShowLabel && (
        <DirectNodeLabel
          id={node.id}
          type={node.type}
          position={node.position}
          isHighlighted={isHighlighted}
          isSelected={isSelected}
          shouldShowLabel={shouldShowLabel}
          cameraZoom={cameraZoom}
          themeHex={themeHex}
          nodeScale={nodeScale}
          connectionPercentage={connectionPercentage}
          showPercentage={showPercentage}
          translatedText={translatedText}
          effectiveTheme={effectiveTheme}
        />
      )}
    </group>
  );
};

export default Node;
