
import React, { useRef, useMemo, useState, useEffect } from 'react';
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
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  // ENHANCED: Coordinated translation props
  getCoordinatedTranslation?: (nodeId: string) => string;
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
  effectiveTheme = 'light',
  isInstantMode = false,
  getCoordinatedTranslation
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const userColorThemeHex = useUserColorThemeHex();
  
  // ANIMATION: Manual time tracking for pulsing effects
  const [animationTime, setAnimationTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  
  // Delayed initialization to prevent clock access issues
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // ENHANCED COORDINATED TRANSLATION: Get coordinated translation for this node with better debugging
  const coordinatedTranslation = useMemo(() => {
    if (getCoordinatedTranslation) {
      const translation = getCoordinatedTranslation(node.id);
      console.log(`[Node] ENHANCED COORDINATED TRANSLATION: Got translation for ${node.id}: "${translation}"`);
      return translation;
    }
    return undefined;
  }, [node.id, getCoordinatedTranslation]);

  // ENHANCED: Much more dramatic color scheme with brighter highlights and darker dims
  const color = useMemo(() => {
    if (isSelected) {
      // ENHANCED: Much brighter selected colors for maximum visibility
      if (node.type === 'entity') {
        return new THREE.Color('#00ff00'); // Bright green for selected entity nodes
      } else {
        return new THREE.Color('#ffa500'); // Bright orange for selected emotion nodes
      }
    }
    
    if (isHighlighted) {
      // ENHANCED: Bright highlighted colors
      if (node.type === 'entity') {
        return new THREE.Color('#22c55e'); // Bright green for highlighted entity nodes
      } else {
        return new THREE.Color('#f59e0b'); // Bright yellow for highlighted emotion nodes
      }
    }
    
    if (dimmed) {
      // ENHANCED: Much darker dimmed colors for dramatic contrast
      return new THREE.Color('#1a1a1a');
    }
    
    // Default state: moderate visibility
    if (node.type === 'entity') {
      return new THREE.Color('#15803d'); // Default green for entity nodes
    } else {
      return new THREE.Color('#d97706'); // Default golden for emotion nodes
    }
  }, [isSelected, isHighlighted, dimmed, node.type]);

  // ENHANCED: Much more dramatic scale differences for better hierarchy
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.2;
    if (isSelected) return baseScale * 2.0; // Much larger for selected (doubled)
    if (isHighlighted) return baseScale * 1.5; // Larger for highlighted
    if (dimmed) return baseScale * 0.4; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, dimmed]);

  // ENHANCED: More dramatic opacity differences
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.95;
    if (dimmed) return 0.1; // Much more transparent for dimmed nodes
    return 0.8;
  }, [isSelected, isHighlighted, dimmed]);

  // ENHANCED: Much more dramatic pulsing animation
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      // Manual time tracking instead of clock access
      setAnimationTime(prev => prev + delta);
      
      if (isHighlighted) {
        // ENHANCED: Much more dramatic pulsing effects
        const pulseIntensity = isSelected ? 0.4 : (connectionPercentage > 0 ? connectionPercentage * 0.006 : 0.25);
        const pulse = Math.sin(animationTime * 3.0) * pulseIntensity + 1.0;
        const targetScale = baseNodeScale * pulse;
        
        // Apply dramatic pulsing scale
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        
        // ENHANCED: Much brighter emissive glow for highlighted nodes
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.5 + Math.sin(animationTime * 4) * 0.5 // Much brighter for selected
            : 1.0 + (connectionPercentage > 0 ? connectionPercentage * 0.01 : 0.3) + Math.sin(animationTime * 3) * 0.3;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(3, emissiveIntensity));
        }
      } else {
        // Static scale for non-highlighted nodes
        const targetScale = dimmed ? baseNodeScale * 0.6 : baseNodeScale;
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.2;
        }
      }
      
      // Update material color and opacity with smooth transitions
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        (meshRef.current.material as THREE.MeshStandardMaterial).color.lerp(color, 0.15);
        meshRef.current.material.opacity = nodeOpacity;
      }
    } catch (error) {
      console.warn("Node pulsing animation error:", error);
    }
  });

  const handleNodeClick = (e: any) => {
    e.stopPropagation();
    console.log(`[Node] ENHANCED NODE CLICK: ${node.id} clicked`);
    onClick(node.id, e);
  };

  // ENHANCED: Show labels for highlighted/selected nodes with better logic
  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false; // Never show labels for dimmed nodes
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, dimmed]);

  // ENHANCED: Better debug logging for percentage display
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[Node] ENHANCED PERCENTAGE DISPLAY: ${node.id} (${node.type}) shows ${connectionPercentage}% connection to ${selectedNodeId}`);
  }

  // ENHANCED: More detailed debug logging for visual state
  console.log(`[Node] ENHANCED VISUAL STATE: ${node.id} (${node.type})`);
  console.log(`  - Selected: ${isSelected}, Highlighted: ${isHighlighted}, Dimmed: ${dimmed}`);
  console.log(`  - Scale: ${baseNodeScale.toFixed(2)}, Opacity: ${nodeOpacity.toFixed(2)}`);
  console.log(`  - Color: ${color.getHexString()}, Translation: "${coordinatedTranslation}"`);

  // ENHANCED: Larger geometry sizes to work with the enhanced scale differences
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      // Larger cube for emotion nodes
      return <boxGeometry args={[1.8, 1.8, 1.8]} />;
    } else {
      // Larger sphere for entity nodes
      return <sphereGeometry args={[0.9, 32, 32]} />;
    }
  };

  // Don't render until ready
  if (!isReady) {
    return null;
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={node.position}
        onClick={handleNodeClick}
        scale={[baseNodeScale, baseNodeScale, baseNodeScale]}
      >
        {renderGeometry()}
        <meshStandardMaterial 
          color={color} 
          metalness={0.2} 
          roughness={0.6}
          transparent={true}
          opacity={nodeOpacity}
          emissive={color}
          emissiveIntensity={isHighlighted ? (isSelected ? 2.0 : 1.5) : (dimmed ? 0 : 0.2)}
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
          nodeScale={baseNodeScale}
          connectionPercentage={connectionPercentage}
          showPercentage={showPercentage}
          effectiveTheme={effectiveTheme}
          isInstantMode={isInstantMode}
          coordinatedTranslation={coordinatedTranslation}
        />
      )}
    </group>
  );
};

export default Node;
