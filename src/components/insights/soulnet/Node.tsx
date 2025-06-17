
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import TranslatableText3D from './TranslatableText3D';
import { useAuth } from '@/contexts/AuthContext';
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
  getInstantTranslation?: (nodeId: string) => string;
  userId?: string;
  timeRange?: string;
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
  getInstantTranslation,
  userId,
  timeRange,
  getCoordinatedTranslation
}) => {
  const { user } = useAuth();
  
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

  // UPDATED: Fixed color scheme with proper default and selected states
  const color = useMemo(() => {
    if (isSelected) {
      // Selected state: Use darker/brighter shades
      if (node.type === 'entity') {
        return new THREE.Color('#16a34a'); // Darker green for selected entity nodes
      } else {
        return new THREE.Color('#d97706'); // Darker golden for selected emotion nodes
      }
    }
    
    if (isHighlighted || (!dimmed && !isSelected)) {
      // Default state: Use the main colors for both highlighted and normal nodes
      if (node.type === 'entity') {
        return new THREE.Color('#22c55e'); // Green for entity nodes (spheres)
      } else {
        return new THREE.Color('#f59e0b'); // Golden for emotion nodes (cubes)
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

  // ENHANCED INSTANT MODE: Better logging for coordinated translation tracking
  if (showPercentage && connectionPercentage > 0) {
    if (isInstantMode) {
      console.log(`[Node] ENHANCED COORDINATED PULSATING INSTANT MODE: ${node.id} (${node.type}) displays percentage: ${connectionPercentage}% with coordinated translation: "${coordinatedTranslation}" - NO LOADING DELAY`);
    } else {
      console.log(`[Node] ENHANCED COORDINATED PULSATING: ${node.id} (${node.type}) should display percentage: ${connectionPercentage}% with coordinated translation: "${coordinatedTranslation}"`);
    }
  }

  if (isInstantMode) {
    console.log(`[Node] ENHANCED FIXED COLORS INSTANT MODE: Rendering ${node.type} node ${node.id} with ${isSelected ? 'SELECTED' : 'DEFAULT'} ${node.type === 'entity' ? 'GREEN' : 'GOLDEN'} color, enhanced coordinated translation: "${coordinatedTranslation}", base scale ${baseNodeScale.toFixed(2)} - NO LOADING DELAY`);
  } else {
    console.log(`[Node] ENHANCED FIXED COLORS: Rendering ${node.type} node ${node.id} with ${isSelected ? 'SELECTED' : 'DEFAULT'} ${node.type === 'entity' ? 'GREEN' : 'GOLDEN'} color, enhanced coordinated translation: "${coordinatedTranslation}", base scale ${baseNodeScale.toFixed(2)}`);
  }

  // ENHANCED: Improved geometry sizes to work with the enhanced scale differences
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      // Cube for emotion nodes (golden)
      return <boxGeometry args={[1.6, 1.6, 1.6]} />;
    } else {
      // Sphere for entity nodes (green)
      return <sphereGeometry args={[0.8, 32, 32]} />;
    }
  };

  // Don't render until ready
  if (!isReady) {
    return null;
  }

  const contextUserId = userId || user?.id;
  
  const labelPosition: [number, number, number] = [node.position[0], node.position[1] + 1.5, node.position[2]];
  const labelColor = new THREE.Color(color);
  const labelSize = 0.5;
  const labelOutlineWidth = 0.05;
  const labelOutlineColor = new THREE.Color('#000000');
  const labelMaxWidth = 1.5;
  const labelMaxCharsPerLine = 10;
  
  const percentagePosition: [number, number, number] = [node.position[0], node.position[1] + 2.5, node.position[2]];
  const percentageColor = new THREE.Color(color);
  const percentageSize = 0.5;
  const percentageOutlineWidth = 0.05;
  const percentageOutlineColor = new THREE.Color('#000000');
  
  return (
    <group position={node.position}>
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
      
      {/* Enhanced label with context-aware translation */}
      {shouldShowLabel && (
        <TranslatableText3D
          text={node.id}
          position={labelPosition}
          color={labelColor}
          size={labelSize}
          visible={shouldShowLabel}
          renderOrder={20}
          bold={false}
          outlineWidth={labelOutlineWidth}
          outlineColor={labelOutlineColor}
          maxWidth={labelMaxWidth}
          enableWrapping={true}
          maxCharsPerLine={labelMaxCharsPerLine}
          maxLines={2}
          userId={contextUserId}
          timeRange={timeRange}
          coordinatedTranslation={isInstantMode ? getInstantTranslation?.(node.id) : undefined}
          useCoordinatedTranslation={isInstantMode}
          onTranslationComplete={(translatedText) => {
            console.log(`[Node] Translation completed for ${node.id}: ${translatedText}`);
          }}
        />
      )}
      
      {/* Enhanced percentage display with context-aware translation */}
      {showPercentage && connectionPercentage > 0 && (
        <TranslatableText3D
          text={`${connectionPercentage}%`}
          position={percentagePosition}
          color={percentageColor}
          size={percentageSize}
          visible={showPercentage}
          renderOrder={25}
          bold={true}
          outlineWidth={percentageOutlineWidth}
          outlineColor={percentageOutlineColor}
          maxWidth={10}
          enableWrapping={false}
          userId={contextUserId}
          timeRange={timeRange}
          useCoordinatedTranslation={false} // Percentages don't need translation
          onTranslationComplete={(translatedText) => {
            console.log(`[Node] Percentage display for ${node.id}: ${translatedText}`);
          }}
        />
      )}
    </group>
  );
};

export default Node;
