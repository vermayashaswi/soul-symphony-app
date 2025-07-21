import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import Node from './Node';
import { Link } from './Link';
import { TouchEventHandler } from './TouchEventHandler';
import { NodeSelectionManager } from './NodeSelectionManager';
import { ConnectionPercentageDisplay } from './ConnectionPercentageDisplay';
import ConnectionCalculator from './ConnectionCalculator';
import { useIsMobile } from '@/hooks/use-mobile';

interface SoulNetNode {
  id: string;
  label: string;
  position: THREE.Vector3;
  [key: string]: any;
}

interface SoulNetLink {
  source: string;
  target: string;
  strength: number;
  [key: string]: any;
}

interface SoulNetVisualizationProps {
  nodes: SoulNetNode[];
  links: SoulNetLink[];
  selectedNode?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  showLabels?: boolean;
  themeHex?: string;
  cameraZoom?: number;
  effectiveTheme?: 'light' | 'dark';
  isInstantMode?: boolean;
  getCoordinatedTranslation?: (key: string) => string;
}

const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  nodes,
  links,
  selectedNode,
  onNodeSelect,
  onNodeHover,
  onNodeClick,
  showLabels = true,
  themeHex = '#8b5cf6',
  cameraZoom = 1,
  effectiveTheme = 'light',
  isInstantMode = false,
  getCoordinatedTranslation
}) => {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isNativeApp, setIsNativeApp] = useState(false);
  
  // Detect native environment
  useEffect(() => {
    const isNative = !!(window as any).Capacitor && 
      ((window as any).Capacitor.getPlatform() === 'android' || 
       (window as any).Capacitor.getPlatform() === 'ios');
    
    setIsNativeApp(isNative);
    console.log('[SoulNetVisualization] Native app detection:', isNative);
  }, []);

  // Calculate connection strengths
  const connectionStrengths = useMemo(() => {
    const strengths = new Map<string, number>();
    
    // Initialize all nodes with base strength
    nodes.forEach(node => {
      strengths.set(node.id, 0.5);
    });
    
    // Calculate based on connections
    links.forEach(link => {
      const strength = link.strength || 0.5;
      strengths.set(link.source, Math.max(strengths.get(link.source) || 0, strength));
      strengths.set(link.target, Math.max(strengths.get(link.target) || 0, strength));
    });
    
    return strengths;
  }, [nodes, links]);

  // Camera configuration optimized for mobile
  const cameraConfig = useMemo(() => {
    const baseDistance = isMobile ? 8 : 10;
    const distance = baseDistance / Math.sqrt(cameraZoom);
    
    return {
      position: [0, 0, distance] as [number, number, number],
      fov: isMobile ? 60 : 50,
      near: 0.1,
      far: 1000
    };
  }, [isMobile, cameraZoom]);

  // Controls configuration
  const controlsConfig = useMemo(() => ({
    enablePan: !isMobile,
    enableZoom: true,
    enableRotate: !isMobile,
    enableDamping: true,
    dampingFactor: 0.05,
    minDistance: 2,
    maxDistance: 20,
    maxPolarAngle: Math.PI,
    touches: {
      ONE: isMobile ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    }
  }), [isMobile]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        style={{ width: '100%', height: '100%' }}
      >
        <PerspectiveCamera
          makeDefault
          position={cameraConfig.position}
          fov={cameraConfig.fov}
          near={cameraConfig.near}
          far={cameraConfig.far}
        />
        
        <OrbitControls {...controlsConfig} />
        
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
        <NodeSelectionManager
          nodes={nodes}
          links={links}
          connectionStrengths={connectionStrengths}
        >
          {({ 
            selectedNodeId, 
            selectedPosition, 
            highlightedNodes, 
            connectionPercentages, 
            animationStartTime,
            onNodeSelect: handleNodeSelect,
            onNodeDeselect: handleNodeDeselect
          }) => (
            <TouchEventHandler
              onNodeSelect={handleNodeSelect}
              onNodeDeselect={handleNodeDeselect}
              nodes={nodes}
            >
              <group>
                {/* Render links */}
                {links.map((link, index) => (
                  <Link
                    key={`link-${index}`}
                    source={nodes.find(n => n.id === link.source)?.position || new THREE.Vector3()}
                    target={nodes.find(n => n.id === link.target)?.position || new THREE.Vector3()}
                    strength={link.strength}
                    isHighlighted={
                      selectedNodeId && (
                        (link.source === selectedNodeId && highlightedNodes.has(link.target)) ||
                        (link.target === selectedNodeId && highlightedNodes.has(link.source))
                      )
                    }
                    isDimmed={selectedNodeId ? !highlightedNodes.has(link.source) && !highlightedNodes.has(link.target) : false}
                    themeHex={themeHex}
                    effectiveTheme={effectiveTheme}
                  />
                ))}
                
                {/* Render nodes */}
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isHighlighted = highlightedNodes.has(node.id);
                  const isDimmed = selectedNodeId ? !highlightedNodes.has(node.id) : false;
                  const connectionPercentage = connectionPercentages.get(node.id) || 0;
                  const showPercentage = selectedNodeId && selectedNodeId !== node.id && isHighlighted;
                  
                  return (
                    <Node
                      key={node.id}
                      node={node}
                      isSelected={isSelected}
                      onClick={() => {
                        if (isSelected) {
                          handleNodeDeselect();
                        } else {
                          handleNodeSelect(node.id, node.position);
                        }
                        onNodeClick?.(node.id);
                      }}
                      isHighlighted={isHighlighted}
                      isDimmed={isDimmed}
                      connectionPercentage={connectionPercentage}
                      showPercentage={showPercentage}
                      connectionStrength={connectionStrengths.get(node.id) || 0.5}
                      showLabel={showLabels}
                      themeHex={themeHex}
                      cameraZoom={cameraZoom}
                      effectiveTheme={effectiveTheme}
                      isInstantMode={isInstantMode}
                      getCoordinatedTranslation={getCoordinatedTranslation}
                      animationStartTime={animationStartTime}
                    />
                  );
                })}
                
                {/* Render connection percentages */}
                {selectedNodeId && selectedPosition && (
                  <>
                    {Array.from(connectionPercentages.entries()).map(([nodeId, percentage]) => {
                      const targetNode = nodes.find(n => n.id === nodeId);
                      if (!targetNode || nodeId === selectedNodeId) return null;
                      
                      return (
                        <ConnectionPercentageDisplay
                          key={`percentage-${selectedNodeId}-${nodeId}`}
                          selectedNodeId={selectedNodeId}
                          targetNodeId={nodeId}
                          selectedPosition={selectedPosition}
                          targetPosition={targetNode.position}
                          connectionStrength={percentage}
                          cameraZoom={cameraZoom}
                          effectiveTheme={effectiveTheme}
                        />
                      );
                    })}
                  </>
                )}
              </group>
            </TouchEventHandler>
          )}
        </NodeSelectionManager>
      </Canvas>
    </div>
  );
};

export default SoulNetVisualization;
