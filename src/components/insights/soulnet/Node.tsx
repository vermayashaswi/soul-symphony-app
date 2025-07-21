
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import MobileTouchHandler from './MobileTouchHandler';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

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
  const [hasError, setHasError] = useState(false);
  const isNativeEnv = nativeIntegrationService.isRunningNatively();
  
  // Enhanced delayed initialization with error handling
  useEffect(() => {
    try {
      const timer = setTimeout(() => {
        setIsReady(true);
        console.log(`[Node] Node ${node.id} ready for rendering`);
      }, isNativeEnv ? 150 : 100);
      
      return () => clearTimeout(timer);
    } catch (error) {
      console.error(`[Node] Error in initialization for ${node.id}:`, error);
      setHasError(true);
    }
  }, [node.id, isNativeEnv]);

  // Enhanced coordinated translation with error handling
  const coordinatedTranslation = useMemo(() => {
    try {
      if (getCoordinatedTranslation) {
        const translation = getCoordinatedTranslation(node.id);
        console.log(`[Node] Coordinated translation for ${node.id}: "${translation}"`);
        return translation;
      }
      return undefined;
    } catch (error) {
      console.error(`[Node] Error getting translation for ${node.id}:`, error);
      return undefined;
    }
  }, [node.id, getCoordinatedTranslation]);

  // Enhanced color scheme with error handling
  const nodeColor = useMemo(() => {
    try {
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
    } catch (error) {
      console.error(`[Node] Error computing color for ${node.id}:`, error);
      return new THREE.Color('#888888'); // Fallback color
    }
  }, [isSelected, isHighlighted, isDimmed, node.type]);

  // Enhanced scale with error handling
  const baseNodeScale = useMemo(() => {
    try {
      const baseScale = 1.15;
      if (isSelected) return baseScale * 1.8;
      if (isHighlighted) return baseScale * 1.4;
      if (isDimmed) return baseScale * 0.5;
      return baseScale;
    } catch (error) {
      console.error(`[Node] Error computing scale for ${node.id}:`, error);
      return 1.0; // Fallback scale
    }
  }, [isSelected, isHighlighted, isDimmed]);

  // Enhanced opacity with error handling
  const nodeOpacity = useMemo(() => {
    try {
      if (isSelected) return 1.0;
      if (isHighlighted) return 0.9;
      if (isDimmed) return 0.1;
      return 0.8;
    } catch (error) {
      console.error(`[Node] Error computing opacity for ${node.id}:`, error);
      return 0.8; // Fallback opacity
    }
  }, [isSelected, isHighlighted, isDimmed]);

  // Enhanced animation with comprehensive error handling
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady || hasError) return;
    
    try {
      setAnimationTime(prev => prev + delta);
      
      if (isSelected || isHighlighted) {
        // Reduced animation intensity for mobile performance
        const pulseIntensity = isNativeEnv 
          ? (isSelected ? 0.2 : connectionStrength * 0.1)
          : (isSelected ? 0.3 : connectionStrength * 0.2);
        
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.0;
        const targetScale = baseNodeScale * pulse;
        
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        // Enhanced material handling with error checks
        if (meshRef.current.material && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? (isNativeEnv ? 0.8 : 1.2) + Math.sin(animationTime * 3) * (isNativeEnv ? 0.2 : 0.4)
            : 0.8 + (connectionStrength * 0.3) + Math.sin(animationTime * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
        }
      } else {
        // Static scale for non-highlighted nodes
        const targetScale = isDimmed ? baseNodeScale * 0.7 : baseNodeScale;
        meshRef.current.scale.set(targetScale, targetScale, targetScale);
        
        if (meshRef.current.material && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.emissiveIntensity = isDimmed ? 0 : 0.1;
        }
      }
      
      // Update material properties with error handling
      if (meshRef.current.material && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
        meshRef.current.material.color.copy(nodeColor);
        meshRef.current.material.opacity = nodeOpacity;
      }
    } catch (error) {
      console.error(`[Node] Animation error for ${node.id}:`, error);
      setHasError(true);
    }
  });

  // Enhanced click handler with comprehensive error handling
  const handleNodeClick = useCallback((nodeId: string, event: any) => {
    try {
      console.log(`[Node] Click handler called for ${nodeId}`);
      
      // Add additional validation
      if (nodeId !== node.id) {
        console.warn(`[Node] Node ID mismatch: expected ${node.id}, got ${nodeId}`);
        return;
      }
      
      // Ensure we have a valid event
      if (!event) {
        console.warn(`[Node] No event provided for ${nodeId}`);
        return;
      }
      
      onClick(nodeId, event);
      console.log(`[Node] Click handler completed successfully for ${nodeId}`);
    } catch (error) {
      console.error(`[Node] Error in click handler for ${nodeId}:`, error);
      // Show user-friendly error
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('soulnet-node-error', { 
          detail: { nodeId, error: error.toString() } 
        }));
      }
    }
  }, [node.id, onClick]);

  // Only show labels for non-dimmed nodes
  const shouldShowLabel = useMemo(() => {
    try {
      if (isDimmed) return false;
      return showLabel || isSelected || isHighlighted;
    } catch (error) {
      console.error(`[Node] Error computing label visibility for ${node.id}:`, error);
      return false;
    }
  }, [showLabel, isSelected, isHighlighted, isDimmed]);

  // Enhanced logging with error context
  if (showPercentage && connectionPercentage > 0) {
    console.log(`[Node] ${node.id} (${node.type}) displays ${connectionPercentage}% with translation: "${coordinatedTranslation}"`);
  }

  console.log(`[Node] Rendering ${node.type} node ${node.id} - selected: ${isSelected}, highlighted: ${isHighlighted}, dimmed: ${isDimmed}, scale: ${baseNodeScale.toFixed(2)}, native: ${isNativeEnv}`);

  // Enhanced geometry with error handling
  const renderGeometry = useCallback(() => {
    try {
      if (node.type === 'emotion') {
        return <boxGeometry args={[1.6, 1.6, 1.6]} />;
      } else {
        return <sphereGeometry args={[0.8, isNativeEnv ? 16 : 32, isNativeEnv ? 16 : 32]} />;
      }
    } catch (error) {
      console.error(`[Node] Error creating geometry for ${node.id}:`, error);
      return <boxGeometry args={[1, 1, 1]} />; // Fallback geometry
    }
  }, [node.type, isNativeEnv]);

  if (!isReady || hasError) return null;

  try {
    return (
      <group>
        <MobileTouchHandler nodeId={node.id} onNodeClick={handleNodeClick}>
          <mesh
            ref={meshRef}
            position={node.position}
            scale={[baseNodeScale, baseNodeScale, baseNodeScale]}
          >
            {renderGeometry()}
            <meshStandardMaterial 
              color={nodeColor} 
              metalness={isNativeEnv ? 0.1 : 0.3} 
              roughness={isNativeEnv ? 0.9 : 0.8}
              transparent={true}
              opacity={nodeOpacity}
              emissive={nodeColor}
              emissiveIntensity={isHighlighted ? (isNativeEnv ? 0.8 : 1.2) : (isDimmed ? 0 : 0.1)}
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
  } catch (error) {
    console.error(`[Node] Error rendering ${node.id}:`, error);
    return null;
  }
};

export default Node;
