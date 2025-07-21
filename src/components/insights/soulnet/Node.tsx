
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import MobileTouchHandler from './MobileTouchHandler';
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
  isHighlighted: boolean;
  isDimmed: boolean;
  connectionPercentage?: number;
  showPercentage?: boolean;
  connectionStrength?: number;
  showLabel: boolean;
  themeHex: string;
  cameraZoom: number;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  getCoordinatedTranslation?: (nodeId: string) => string;
  // Additional props from SoulNetVisualization
  highlightedNodes?: Set<string>;
  selectedNodeId?: string | null;
  dimmed?: boolean;
  forceShowLabels?: boolean;
}

const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onClick,
  isHighlighted,
  isDimmed,
  connectionPercentage = 0,
  showPercentage = false,
  connectionStrength = 0.5,
  showLabel,
  themeHex,
  cameraZoom,
  effectiveTheme = 'light',
  isInstantMode = false,
  getCoordinatedTranslation,
  // Additional props (with fallbacks)
  highlightedNodes,
  selectedNodeId,
  dimmed,
  forceShowLabels
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [animationTime, setAnimationTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  
  // Delayed initialization
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Enhanced coordinated translation
  const coordinatedTranslation = useMemo(() => {
    if (getCoordinatedTranslation) {
      const translation = getCoordinatedTranslation(node.id);
      console.log(`[Node] Coordinated translation for ${node.id}: "${translation}"`);
      return translation;
    }
    return undefined;
  }, [node.id, getCoordinatedTranslation]);

  // Enhanced color scheme with proper highlighting
  const nodeColor = useMemo(() => {
    if (isSelected) {
      return new THREE.Color(node.type === 'entity' ? '#14532d' : '#b45309');
    }
    
    if (isHighlighted) {
      return new THREE.Color(node.type === 'entity' ? '#15803d' : '#d97706');
    }
    
    if (isDimmed) {
      return new THREE.Color('#4a4a4a');
    }
    
    return new THREE.Color(node.type === 'entity' ? '#15803d' : '#d97706');
  }, [isSelected, isHighlighted, isDimmed, node.type]);

  // Enhanced scale with dramatic differences
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.15;
    if (isSelected) return baseScale * 1.8; // Much larger for selected
    if (isHighlighted) return baseScale * 1.4; // Larger for highlighted
    if (isDimmed) return baseScale * 0.5; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, isDimmed]);

  // Enhanced opacity
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.9;
    if (isDimmed) return 0.1; // Much more transparent for dimmed
    return 0.8;
  }, [isSelected, isHighlighted, isDimmed]);

  // Enhanced pulsating animation
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      setAnimationTime(prev => prev + delta);
      
      if (isSelected || isHighlighted) {
        // Different pulse intensities
        const pulseIntensity = isSelected ? 0.3 : (connectionStrength * 0.2);
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.0;
        const targetScale = baseNodeScale * pulse;
        
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        // Breathing glow effect
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.2 + Math.sin(animationTime * 3) * 0.4
            : 0.8 + (connectionStrength * 0.3) + Math.sin(animationTime * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
        }
      } else {
        // Static scale for non-highlighted nodes
        const targetScale = isDimmed ? baseNodeScale * 0.7 : baseNodeScale;
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = isDimmed ? 0 : 0.1;
        }
      }
      
      // Update material properties
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.color.copy(nodeColor);
        meshRef.current.material.opacity = nodeOpacity;
      }
    } catch (error) {
      console.warn("Node animation error:", error);
    }
  });

  // Only show labels for non-dimmed nodes
  const shouldShowLabel = useMemo(() => {
    if (isDimmed) return false;
    return showLabel || isSelected || isHighlighted;
  }, [showLabel, isSelected, isHighlighted, isDimmed]);

  // Enhanced logging
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[Node] ${node.id} (${node.type}) displays ${connectionPercentage}% with translation: "${coordinatedTranslation}"`);
  }

  console.log(`[Node] Rendering ${node.type} node ${node.id} - selected: ${isSelected}, highlighted: ${isHighlighted}, dimmed: ${isDimmed}, scale: ${baseNodeScale.toFixed(2)}`);

  // Enhanced geometry
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      return <boxGeometry args={[1.6, 1.6, 1.6]} />;
    } else {
      return <sphereGeometry args={[0.8, 32, 32]} />;
    }
  };

  if (!isReady) return null;

  return (
    <group>
      <MobileTouchHandler nodeId={node.id} onNodeClick={onClick}>
        <mesh
          ref={meshRef}
          position={node.position}
          scale={[baseNodeScale, baseNodeScale, baseNodeScale]}
        >
          {renderGeometry()}
          <meshStandardMaterial 
            color={nodeColor} 
            metalness={0.3} 
            roughness={0.8}
            transparent={true}
            opacity={nodeOpacity}
            emissive={nodeColor}
            emissiveIntensity={isHighlighted ? 1.2 : (isDimmed ? 0 : 0.1)}
          />
        </mesh>
      </MobileTouchHandler>
      
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
