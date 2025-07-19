
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
  
  const [animationTime, setAnimationTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const coordinatedTranslation = useMemo(() => {
    if (getCoordinatedTranslation) {
      const translation = getCoordinatedTranslation(node.id);
      return translation;
    }
    return node.id;
  }, [node.id, getCoordinatedTranslation]);

  // ENHANCED: Improved color scheme with better contrast and selection feedback
  const color = useMemo(() => {
    if (isSelected) {
      // Selected state: Bright, high-contrast colors
      if (node.type === 'entity') {
        return new THREE.Color('#10b981'); // Bright emerald for selected entities
      } else {
        return new THREE.Color('#f59e0b'); // Bright amber for selected emotions
      }
    }
    
    if (isHighlighted) {
      // Highlighted state: Medium brightness
      if (node.type === 'entity') {
        return new THREE.Color('#059669'); // Medium emerald for highlighted entities
      } else {
        return new THREE.Color('#d97706'); // Medium amber for highlighted emotions
      }
    }
    
    if (!dimmed) {
      // Default state: Standard colors
      if (node.type === 'entity') {
        return new THREE.Color('#047857'); // Standard emerald for entities
      } else {
        return new THREE.Color('#b45309'); // Standard amber for emotions
      }
    }
    
    // Dimmed state: Subtle gray
    return new THREE.Color('#64748b');
  }, [isSelected, isHighlighted, dimmed, node.type]);

  // ENHANCED: Dynamic scaling with better selection feedback
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.2;
    if (isSelected) return baseScale * 1.8; // Much larger for selected
    if (isHighlighted) return baseScale * 1.4; // Larger for highlighted
    if (isHovered) return baseScale * 1.1; // Slightly larger on hover
    if (dimmed) return baseScale * 0.5; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, isHovered, dimmed]);

  // ENHANCED: Better opacity for visual hierarchy
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.95;
    if (isHovered) return 0.9;
    if (dimmed) return 0.15; // More visible when dimmed
    return 0.85;
  }, [isSelected, isHighlighted, isHovered, dimmed]);

  // ENHANCED: Improved animation with better performance
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      setAnimationTime(prev => prev + delta);
      
      if (isSelected || isHighlighted) {
        // Enhanced pulsing animation for selected/highlighted nodes
        const pulseBase = isSelected ? 0.3 : 0.2;
        const pulseSpeed = isSelected ? 3.0 : 2.0;
        const pulse = Math.sin(animationTime * pulseSpeed) * pulseBase + 1.0;
        const targetScale = baseNodeScale * pulse;
        
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
        
        // Enhanced emissive glow
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveBase = isSelected ? 1.2 : 0.8;
          const emissiveIntensity = emissiveBase + Math.sin(animationTime * pulseSpeed) * 0.4;
          meshRef.current.material.emissiveIntensity = Math.max(0.1, Math.min(2.0, emissiveIntensity));
        }
      } else {
        // Static scale for non-highlighted nodes
        const targetScale = baseNodeScale;
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.15;
        }
      }
      
      // Smooth color and opacity transitions
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.color.lerp(color, 0.1);
        meshRef.current.material.opacity = nodeOpacity;
      }
    } catch (error) {
      console.warn("Node animation error:", error);
    }
  });

  // ENHANCED: Improved click handling with proper event handling
  const handleNodeClick = (e: any) => {
    e.stopPropagation();
    console.log(`[Node] CLICK DETECTED: ${node.id} (${node.type})`);
    
    // Add haptic feedback for mobile
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    onClick(node.id, e);
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    document.body.style.cursor = 'auto';
  };

  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false;
    return forceShowLabels || showLabel || isSelected || isHighlighted || isHovered;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, isHovered, dimmed]);

  const renderGeometry = () => {
    if (node.type === 'emotion') {
      return <boxGeometry args={[1.8, 1.8, 1.8]} />;
    } else {
      return <sphereGeometry args={[0.9, 32, 32]} />;
    }
  };

  if (!isReady) {
    return null;
  }

  console.log(`[Node] ENHANCED RENDER: ${node.id} - selected: ${isSelected}, highlighted: ${isHighlighted}, showPercentage: ${showPercentage}, percentage: ${connectionPercentage}%`);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={node.position}
        onClick={handleNodeClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
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
          emissiveIntensity={isHighlighted ? 1.0 : (dimmed ? 0 : 0.15)}
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
