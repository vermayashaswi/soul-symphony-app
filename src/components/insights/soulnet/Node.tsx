
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import { useUserColorThemeHex } from './useUserColorThemeHex';
import { useSoulNetTranslation } from '@/hooks/useSoulNetTranslation';

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
  isInstantMode = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const userColorThemeHex = useUserColorThemeHex();
  const { isNodeTranslating } = useSoulNetTranslation();
  
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

  // Check if this node is currently being translated
  const isTranslating = isNodeTranslating(node.id);

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
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.15;
    if (isSelected) return baseScale * 1.6; // Even larger for selected
    if (isHighlighted) return baseScale * 1.3; // Larger for highlighted
    if (dimmed) return baseScale * 0.6; // Much smaller for dimmed
    return baseScale;
  }, [isSelected, isHighlighted, dimmed]);

  // ENHANCED: Increased opacity for dimmed nodes, slightly reduced for translating
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isTranslating) return 0.7; // Slightly dimmed while translating
    if (isHighlighted) return 0.9;
    if (dimmed) return 0.05; // Increased from extremely low to 0.05
    return 0.8;
  }, [isSelected, isHighlighted, dimmed, isTranslating]);

  // PULSATING ANIMATION: Enhanced frame animation with pulsing effects
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      // Manual time tracking instead of clock access
      setAnimationTime(prev => prev + delta);
      
      if (isHighlighted) {
        // PULSATING: Different pulse intensities based on connection state
        const pulseIntensity = isSelected ? 0.25 : (connectionPercentage > 0 ? connectionPercentage * 0.003 : 0.15);
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.0;
        const targetScale = baseNodeScale * pulse;
        
        // Apply pulsing scale
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        
        // PULSATING: Emissive glow breathing effect
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.0 + Math.sin(animationTime * 3) * 0.3
            : 0.7 + (connectionPercentage > 0 ? connectionPercentage * 0.005 : 0.2) + Math.sin(animationTime * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
        }
      } else {
        // Static scale for non-highlighted nodes
        const targetScale = dimmed ? baseNodeScale * 0.8 : baseNodeScale;
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = dimmed ? 0 : 0.1;
        }
      }
      
      // Update material color and opacity
      meshRef.current.material.color.lerp(color, 0.1);
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.opacity = nodeOpacity;
      }
    } catch (error) {
      console.warn("Node pulsing animation error:", error);
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
      console.log(`[Node] MAIN TRANSLATION SERVICE INSTANT MODE: ${node.id} (${node.type}) displays percentage: ${connectionPercentage}% with pulse intensity based on connection strength - NO LOADING DELAY`);
    } else {
      console.log(`[Node] MAIN TRANSLATION SERVICE ENHANCED: ${node.id} (${node.type}) should display percentage: ${connectionPercentage}% with pulse intensity based on connection strength`);
    }
  }

  if (isInstantMode) {
    console.log(`[Node] MAIN TRANSLATION SERVICE INSTANT MODE: Rendering ${node.type} node ${node.id} with pulsing animation, app theme color ${userColorThemeHex}, base scale ${baseNodeScale.toFixed(2)}, translating: ${isTranslating} - NO LOADING DELAY`);
  } else {
    console.log(`[Node] MAIN TRANSLATION SERVICE ENHANCED: Rendering ${node.type} node ${node.id} with pulsing animation, app theme color ${userColorThemeHex}, base scale ${baseNodeScale.toFixed(2)}, translating: ${isTranslating}`);
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
          metalness={0.3} 
          roughness={0.8}
          transparent={true}
          opacity={nodeOpacity}
          emissive={color}
          emissiveIntensity={isHighlighted ? 1.2 : (dimmed ? 0 : 0.1)}
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
        />
      )}
    </group>
  );
};

export default Node;
