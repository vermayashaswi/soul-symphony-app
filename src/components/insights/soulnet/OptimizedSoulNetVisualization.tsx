
import React, { useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import OptimizedNode from './OptimizedNode';
import Edge from './Edge';
import { useOptimizedSoulNetData } from '@/hooks/useOptimizedSoulNetData';

interface OptimizedSoulNetVisualizationProps {
  userId: string | undefined;
  timeRange: string;
  themeHex: string;
  isFullScreen: boolean;
  effectiveTheme: 'light' | 'dark';
}

export const OptimizedSoulNetVisualization: React.FC<OptimizedSoulNetVisualizationProps> = ({
  userId,
  timeRange,
  themeHex,
  isFullScreen,
  effectiveTheme
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [cameraZoom, setCameraZoom] = useState(45);

  const {
    optimizedNodes,
    originalLinks,
    loading,
    error,
    isReady,
    getConnectionData,
    getInstantTranslation
  } = useOptimizedSoulNetData(userId, timeRange);

  // Instant node selection with no delays
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log(`[OptimizedSoulNetVisualization] INSTANT: Node selected ${nodeId} - no computation delay`);
    
    setSelectedNodeId(prev => {
      const newSelection = prev === nodeId ? null : nodeId;
      
      // Haptic feedback for mobile
      if (navigator.vibrate && newSelection) {
        navigator.vibrate(50);
      }
      
      return newSelection;
    });
  }, []);

  // Track camera zoom efficiently
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.5) {
      setCameraZoom(newZoom);
    }
  });

  // Pre-compute edge visibility states
  const edgeStates = useMemo(() => {
    if (!selectedNodeId) {
      return originalLinks.map(() => ({ isHighlighted: false, isDimmed: false }));
    }

    const selectedConnections = getConnectionData(selectedNodeId);
    
    return originalLinks.map(link => {
      const isHighlighted = (link.source === selectedNodeId || link.target === selectedNodeId);
      const isDimmed = !isHighlighted;
      
      return { isHighlighted, isDimmed };
    });
  }, [selectedNodeId, originalLinks, getConnectionData]);

  // Find node by ID efficiently
  const nodeMap = useMemo(() => {
    const map = new Map();
    optimizedNodes.forEach(node => map.set(node.id, node));
    return map;
  }, [optimizedNodes]);

  if (loading || !isReady) {
    return null; // No loading state needed - should be instant
  }

  if (error) {
    console.error('[OptimizedSoulNetVisualization] Error:', error);
    return null;
  }

  console.log(`[OptimizedSoulNetVisualization] INSTANT RENDER: ${optimizedNodes.length} nodes, ${originalLinks.length} links - zero delays`);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} />
      <OrbitControls 
        enablePan={true} 
        enableZoom={true} 
        enableRotate={true}
        minDistance={15}
        maxDistance={120}
        enableDamping={true}
        dampingFactor={0.05}
      />
      
      {/* Render nodes with instant updates */}
      {optimizedNodes.map((node) => (
        <OptimizedNode
          key={node.id}
          node={node}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
          themeHex={themeHex}
          translatedText={getInstantTranslation(node.id)}
          cameraZoom={cameraZoom}
          effectiveTheme={effectiveTheme}
        />
      ))}
      
      {/* Render edges with pre-computed states */}
      {originalLinks.map((link, index) => {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        
        if (!sourceNode || !targetNode) {
          return null;
        }
        
        const edgeState = edgeStates[index];
        
        return (
          <Edge
            key={`${link.source}-${link.target}-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={link.value}
            isHighlighted={edgeState.isHighlighted}
            dimmed={edgeState.isDimmed}
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
          />
        );
      })}
    </>
  );
};

export default OptimizedSoulNetVisualization;
