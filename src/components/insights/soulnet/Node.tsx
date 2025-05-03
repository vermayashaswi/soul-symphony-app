
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import NodeLabel from './NodeLabel';
import NodeMesh from './NodeMesh';
import ConnectionPercentage from './ConnectionPercentage';

interface NodeProps {
  node: {
    id: string;
    type: 'entity' | 'emotion';
    position: [number, number, number];
    color: string;
  };
  isSelected: boolean;
  onClick: (id: string) => void;
  highlightedNodes: Set<string>;
  showLabel: boolean;
  dimmed: boolean;
  themeHex: string;
  selectedNodeId: string | null;
  cameraZoom?: number;
  isHighlighted: boolean;
  connectionStrength: number;
  connectionPercentage: number;
  showPercentage: boolean;
  translatedText?: string; // Added prop for pre-translated text
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
  cameraZoom = 26,
  isHighlighted,
  connectionStrength,
  connectionPercentage,
  showPercentage,
  translatedText
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const previousPositionRef = useRef<[number, number, number]>(node.position);
  const targetPositionRef = useRef<[number, number, number]>(node.position);
  
  // Use the pre-translated text if provided, or fall back to node.id
  const displayText = translatedText || node.id;
  
  // Debug logging
  if (isSelected || isHighlighted) {
    console.log(
      `Node: ${node.id}, isSelected: ${isSelected}, isHighlighted: ${isHighlighted}, ` +
      `showLabel: ${showLabel}, displayText: ${displayText}`
    );
  }

  // Update target position for animated transitions
  targetPositionRef.current = node.position;

  // Ease the mesh position towards target for smooth animation
  useFrame(() => {
    if (!meshRef.current) return;
    
    const mesh = meshRef.current;
    
    // Simple ease towards target position
    const lerpFactor = 0.1;
    mesh.position.x += (targetPositionRef.current[0] - mesh.position.x) * lerpFactor;
    mesh.position.y += (targetPositionRef.current[1] - mesh.position.y) * lerpFactor;
    mesh.position.z += (targetPositionRef.current[2] - mesh.position.z) * lerpFactor;
    
    // Slight rotation animation
    if (!dimmed) {
      mesh.rotation.x += 0.003;
      mesh.rotation.y += 0.001;
    }
    
    previousPositionRef.current = [mesh.position.x, mesh.position.y, mesh.position.z];
  });

  // Determine the appropriate size scaling for the node
  const nodeScale = useMemo(() => {
    const baseScale = node.type === 'entity' ? 1.2 : 0.85;
    
    // Scale up if selected or highlighted
    if (isSelected) return baseScale * 1.3;
    if (isHighlighted) return baseScale * (1 + connectionStrength * 0.4);
    if (dimmed) return baseScale * 0.75;
    
    return baseScale;
  }, [node.type, isSelected, isHighlighted, dimmed, connectionStrength]);

  // Handle node click
  const handleNodeClick = (e: any) => {
    e.stopPropagation();
    onClick(node.id);
  };

  return (
    <group position={node.position}>
      <NodeMesh 
        ref={meshRef}
        scale={nodeScale}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        dimmed={dimmed}
        type={node.type}
        themeHex={themeHex}
        onClick={handleNodeClick}
      />
      
      {showLabel && (
        <NodeLabel
          id={displayText} // Use the translated text here
          type={node.type}
          position={node.position}
          isHighlighted={isHighlighted || isSelected}
          shouldShowLabel={showLabel}
          cameraZoom={cameraZoom}
          themeHex={themeHex}
        />
      )}
      
      {showPercentage && connectionPercentage > 0 && (
        <ConnectionPercentage
          position={node.position}
          percentage={connectionPercentage}
          isVisible={showPercentage}
          nodeType={node.type}
        />
      )}
    </group>
  );
};

export default Node;
