
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
      if (isInstantMode) {
        console.log(`[Node] ENHANCED COORDINATED INSTANT: Got coordinated translation for ${node.id}: "${translation}" - NO LOADING DELAY`);
      } else {
        console.log(`[Node] ENHANCED COORDINATED: Got coordinated translation for ${node.id}: "${translation}"`);
      }
      return translation;
    }
    if (isInstantMode) {
      console.log(`[Node] ENHANCED COORDINATED INSTANT: No coordinated translation function available for ${node.id} - NO LOADING DELAY`);
    } else {
      console.log(`[Node] ENHANCED COORDINATED: No coordinated translation function available for ${node.id}`);
    }
    return undefined;
  }, [node.id, getCoordinatedTranslation, isInstantMode]);

  // UPDATED: New darker color scheme implementation
  const color = useMemo(() => {
    if (isSelected) {
      // Selected state: Use darker shades
      if (node.type === 'entity') {
        return new THREE.Color('#14532d'); // Much darker green for selected entity nodes
      } else {
        return new THREE.Color('#b45309'); // Much darker golden for selected emotion nodes
      }
    }
    
    if (isHighlighted || (!dimmed && !isSelected)) {
      // Default state: Use the new darker colors for both highlighted and normal nodes
      if (node.type === 'entity') {
        return new THREE.Color('#15803d'); // Darker green for entity nodes (spheres)
      } else {
        return new THREE.Color('#d97706'); // Darker golden for emotion nodes (cubes)
      }
    }
    
    // ENHANCED: 20% lighter colors for dimmed nodes instead of very dark
    return new THREE.Color(dimmed ? '#3a3a3a' : '#cccccc');
  }, [isSelected, isHighlighted, dimmed, node.type]);

  // ENHANCED: More dramatic scale differences for better hierarchy
  const baseNodeScale = useMemo(() => {
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
      if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        (meshRef.current.material as THREE.MeshStandardMaterial).color.lerp(color, 0.1);
        meshRef.current.material.opacity = nodeOpacity;
      }
    } catch (error) {
      console.warn("Node pulsing animation error:", error);
    }
  });

  // SOUL-NET SELECTION FIX: Enhanced click handler with debug logging
  const handleNodeClick = (e: any) => {
    console.log(`[Node] SOUL-NET SELECTION FIX: Click event triggered for node ${node.id}`, {
      nodeId: node.id,
      nodeType: node.type,
      isSelected,
      isHighlighted,
      dimmed,
      event: e,
      position: node.position,
      connectionPercentage,
      showPercentage
    });
    
    // Stop event propagation to prevent canvas click
    e.stopPropagation();
    
    // Add vibration feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
      console.log(`[Node] SOUL-NET SELECTION FIX: Vibration triggered for node ${node.id}`);
    }
    
    // Call the onClick handler
    try {
      onClick(node.id, e);
      console.log(`[Node] SOUL-NET SELECTION FIX: onClick handler called successfully for node ${node.id}`);
    } catch (error) {
      console.error(`[Node] SOUL-NET SELECTION FIX: Error in onClick handler for node ${node.id}:`, error);
    }
  };

  // ENHANCED: Only show labels for highlighted/selected nodes or when forced
  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false; // Never show labels for dimmed nodes
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, dimmed]);

  // ENHANCED INSTANT MODE: Better logging for coordinated translation tracking
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[Node] ENHANCED COORDINATED PULSATING INSTANT MODE: ${node.id} (${node.type}) displays percentage: ${connectionPercentage}% with coordinated translation: "${coordinatedTranslation}" - NO LOADING DELAY`);
    } else {
      console.log(`[Node] ENHANCED COORDINATED PULSATING: ${node.id} (${node.type}) should display percentage: ${connectionPercentage}% with coordinated translation: "${coordinatedTranslation}"`);
    }
  }

  if (isInstantMode) {
    console.log(`[Node] ENHANCED DARKER COLORS INSTANT MODE: Rendering ${node.type} node ${node.id} with ${isSelected ? 'SELECTED' : 'DEFAULT'} DARKER ${node.type === 'entity' ? 'GREEN' : 'GOLDEN'} color, enhanced coordinated translation: "${coordinatedTranslation}", base scale ${baseNodeScale.toFixed(2)} - NO LOADING DELAY`);
  } else {
    console.log(`[Node] ENHANCED DARKER COLORS: Rendering ${node.type} node ${node.id} with ${isSelected ? 'SELECTED' : 'DEFAULT'} DARKER ${node.type === 'entity' ? 'GREEN' : 'GOLDEN'} color, enhanced coordinated translation: "${coordinatedTranslation}", base scale ${baseNodeScale.toFixed(2)}`);
  }

  // ENHANCED: Improved geometry sizes to work with the enhanced scale differences
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      // Cube for emotion nodes (darker golden)
      return <boxGeometry args={[1.6, 1.6, 1.6]} />;
    } else {
      // Sphere for entity nodes (darker green)
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
        onPointerDown={(e) => {
          // SOUL-NET SELECTION FIX: Additional event handling for better click detection
          console.log(`[Node] SOUL-NET SELECTION FIX: Pointer down event for node ${node.id}`);
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          // SOUL-NET SELECTION FIX: Additional event handling for better click detection
          console.log(`[Node] SOUL-NET SELECTION FIX: Pointer up event for node ${node.id}`);
          e.stopPropagation();
        }}
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
          coordinatedTranslation={coordinatedTranslation}
        />
      )}
    </group>
  );
};

export default Node;
