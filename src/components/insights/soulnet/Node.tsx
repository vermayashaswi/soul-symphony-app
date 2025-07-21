
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DirectNodeLabel from './DirectNodeLabel';
import MobileNodeInteraction from './MobileNodeInteraction';
import { useUserColorThemeHex } from './useUserColorThemeHex';
import { useIsMobile } from '@/hooks/use-mobile';

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
  onClick: (id: string, event?: any) => void;
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
  const isMobile = useIsMobile();
  
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

  // ENHANCED COORDINATED TRANSLATION: Get coordinated translation
  const coordinatedTranslation = useMemo(() => {
    if (getCoordinatedTranslation) {
      const translation = getCoordinatedTranslation(node.id);
      console.log(`[Node] ENHANCED TOUCH: Got coordinated translation for ${node.id}: "${translation}"`);
      return translation;
    }
    return undefined;
  }, [node.id, getCoordinatedTranslation]);

  // UPDATED: Enhanced color scheme
  const color = useMemo(() => {
    if (isSelected) {
      if (node.type === 'entity') {
        return new THREE.Color('#14532d'); // Dark green for selected entity nodes
      } else {
        return new THREE.Color('#b45309'); // Dark golden for selected emotion nodes
      }
    }
    
    if (isHighlighted || (!dimmed && !isSelected)) {
      if (node.type === 'entity') {
        return new THREE.Color('#15803d'); // Darker green for entity nodes
      } else {
        return new THREE.Color('#d97706'); // Darker golden for emotion nodes
      }
    }
    
    return new THREE.Color(dimmed ? '#3a3a3a' : '#cccccc');
  }, [isSelected, isHighlighted, dimmed, node.type]);

  // ENHANCED: More dramatic scale differences
  const baseNodeScale = useMemo(() => {
    const baseScale = 1.15;
    if (isSelected) return baseScale * 1.6;
    if (isHighlighted) return baseScale * 1.3;
    if (dimmed) return baseScale * 0.6;
    return baseScale;
  }, [isSelected, isHighlighted, dimmed]);

  // ENHANCED: Improved opacity
  const nodeOpacity = useMemo(() => {
    if (isSelected) return 1.0;
    if (isHighlighted) return 0.9;
    if (dimmed) return 0.05;
    return 0.8;
  }, [isSelected, isHighlighted, dimmed]);

  // ENHANCED: Mobile-optimized animation
  useFrame((state, delta) => {
    if (!meshRef.current || !isReady) return;
    
    try {
      setAnimationTime(prev => prev + delta);
      
      if (isHighlighted) {
        const pulseIntensity = isSelected ? 0.25 : (connectionPercentage > 0 ? connectionPercentage * 0.003 : 0.15);
        const pulse = Math.sin(animationTime * 2.5) * pulseIntensity + 1.0;
        const targetScale = baseNodeScale * pulse;
        
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        
        if (meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          const emissiveIntensity = isSelected 
            ? 1.0 + Math.sin(animationTime * 3) * 0.3
            : 0.7 + (connectionPercentage > 0 ? connectionPercentage * 0.005 : 0.2) + Math.sin(animationTime * 3) * 0.2;
          
          meshRef.current.material.emissiveIntensity = Math.max(0, Math.min(2, emissiveIntensity));
        }
      } else {
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
      console.warn("Node animation error:", error);
    }
  });

  // ENHANCED TOUCH: Mobile-optimized click handler
  const handleNodeClick = (e: any) => {
    console.log(`[Node] ENHANCED TOUCH: Touch interaction for node ${node.id}`, {
      nodeId: node.id,
      nodeType: node.type,
      isSelected,
      isHighlighted,
      dimmed,
      isMobile
    });
    
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // Enhanced vibration for mobile
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(75); // Longer vibration for mobile
    }
    
    try {
      onClick(node.id, e);
      console.log(`[Node] ENHANCED TOUCH: onClick handler called successfully for node ${node.id}`);
    } catch (error) {
      console.error(`[Node] ENHANCED TOUCH: Error in onClick handler for node ${node.id}:`, error);
    }
  };

  // Show labels logic
  const shouldShowLabel = useMemo(() => {
    if (dimmed) return false;
    return forceShowLabels || showLabel || isSelected || isHighlighted;
  }, [forceShowLabels, showLabel, isSelected, isHighlighted, dimmed]);

  // ENHANCED: Improved geometry sizes
  const renderGeometry = () => {
    if (node.type === 'emotion') {
      return <boxGeometry args={[1.6, 1.6, 1.6]} />;
    } else {
      return <sphereGeometry args={[0.8, 32, 32]} />;
    }
  };

  if (!isReady) {
    return null;
  }

  console.log(`[Node] ENHANCED TOUCH: Rendering ${node.type} node ${node.id} with enhanced touch support, mobile: ${isMobile}`);

  return (
    <group>
      {/* ENHANCED: Mobile-optimized interaction layer */}
      {isMobile && (
        <MobileNodeInteraction
          node={node}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          dimmed={dimmed}
          onTouch={handleNodeClick}
          scale={baseNodeScale}
        />
      )}
      
      {/* Visual node mesh */}
      <mesh
        ref={meshRef}
        position={node.position}
        onClick={handleNodeClick}
        onPointerDown={(e) => {
          console.log(`[Node] ENHANCED TOUCH: Pointer down event for node ${node.id}`);
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          console.log(`[Node] ENHANCED TOUCH: Pointer up event for node ${node.id}`);
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
