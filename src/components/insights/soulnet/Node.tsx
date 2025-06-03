
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import { useUserColorThemeHex } from './useUserColorThemeHex';

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
  isInstantMode?: boolean;
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
  effectiveTheme = 'light',
  isInstantMode = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const userColorThemeHex = useUserColorThemeHex();

  // UPDATED: Use app color theme for both node types in both light and dark themes
  const color = useMemo(() => {
    if (isSelected) return new THREE.Color('#ffffff');
    
    if (isHighlighted) {
      // Both entity and emotion nodes use the app color theme when highlighted
      return new THREE.Color(userColorThemeHex);
    }
    
    // ENHANCED: 20% lighter colors for dimmed nodes instead of very dark
    return new THREE.Color(dimmed ? '#3a3a3a' : '#cccccc');
  }, [isSelected, isHighlighted, userColorThemeHex, dimmed]);

  // ENHANCED: More dramatic scale differences for better hierarchy
  const nodeScale = useMemo(() => {
    const baseScale = 1.15;
    if (isSelected) return baseScale * 1.6; // Even larger for selected
    if (isHighlighted) return baseScale * 1.3; // Larger for highlighted
    if (dimmed) return baseScale * 0.6; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, dimmed]);

  // ENHANCED: Increased opacity for dimmed nodes to 0.05-0.06
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.9;
    if (dimmed) return 0.05; // Increased from extremely low to 0.05
    return 0.8;
  }, [isSelected, isHighlighted, dimmed]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.material.color.lerp(color, 0.1);
      meshRef.current.scale.lerp(new THREE.Vector3(nodeScale, nodeScale, nodeScale), 0.1);
      
      // Update opacity
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.opacity = nodeOpacity;
      }
    }
  });

  const handleNodeClick = (e: any) => {
    e.stopPropagation();
    onClick(node.id, e);
  };

  // ENHANCED: Only show labels for highlighted/selected nodes or when forced
  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false; // Never show labels for dimmed nodes
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, dimmed]);

  // INSTANT MODE: Better logging for percentage tracking with comprehensive debug info
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[Node] INSTANT MODE: ${node.id} (${node.type}) displays percentage: ${connectionPercentage}% (isHighlighted: ${isHighlighted}, isSelected: ${isSelected}) - NO LOADING DELAY`);
    } else {
      console.log(`[Node] ENHANCED: ${node.id} (${node.type}) should display percentage: ${connectionPercentage}% (isHighlighted: ${isHighlighted}, isSelected: ${isSelected})`);
    }
  }

  if (isInstantMode) {
    console.log(`[Node] INSTANT MODE: Rendering ${node.type} node ${node.id} with app theme color ${userColorThemeHex}, scale ${nodeScale.toFixed(2)} and translated text: "${translatedText || node.id}" and percentage display: ${showPercentage ? connectionPercentage + '%' : 'none'} - NO LOADING DELAY`);
  } else {
    console.log(`[Node] ENHANCED: Rendering ${node.type} node ${node.id} with app theme color ${userColorThemeHex}, scale ${nodeScale.toFixed(2)} and translated text: "${translatedText || node.id}" and percentage display: ${showPercentage ? connectionPercentage + '%' : 'none'}`);
  }

  // ENHANCED: Improved geometry sizes to work with the enhanced scale differences
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      // Cube for emotion nodes
      return <boxGeometry args={[1.6, 1.6, 1.6]} />;
    } else {
      // Sphere for entity nodes
      return <sphereGeometry args={[0.8, 32, 32]} />;
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
        <meshStandardMaterial 
          color={color} 
          metalness={0.3} 
          roughness={0.8}
          transparent={true}
          opacity={nodeOpacity}
        />
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
          isInstantMode={isInstantMode}
        />
      )}
    </group>
  );
};

export default Node;
