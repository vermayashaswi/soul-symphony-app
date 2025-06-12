import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Node from './Node';
import Edge from './Edge';
import { useIsMobile } from '@/hooks/use-mobile';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

interface SimplifiedSoulNetVisualizationProps {
  data: GraphData;
  selectedNode: string | null;
  onNodeClick: (id: string, event: any) => void;
  themeHex: string;
  isFullScreen: boolean;
  shouldShowLabels: boolean;
  getInstantConnectionPercentage?: (selectedNode: string, targetNode: string) => number;
  getInstantTranslation?: (nodeId: string) => string;
  getInstantNodeConnections?: (nodeId: string) => any;
  isInstantReady?: boolean;
  isAtomicMode?: boolean;
}

// ENHANCED: Y-axis distance pattern for circle nodes (entity nodes)
const getCircleNodeYDistance = (nodeIndex: number): number => {
  const patterns = [
    2,      // node 1: +2
    -2,     // node 2: -2
    2.25,   // node 3: +2.25
    -2.25,  // node 4: -2.25
    2.5,    // node 5: +2.5
    -2.5,   // node 6: -2.5
    2,      // node 7: +2
    -2      // node 8: -2
  ];
  
  // For nodes beyond the initial pattern, continue the alternating pattern
  if (nodeIndex >= patterns.length) {
    const cycleIndex = nodeIndex % 8;
    return patterns[cycleIndex];
  }
  
  return patterns[nodeIndex];
};

const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  shouldShowLabels,
  getInstantConnectionPercentage,
  getInstantTranslation,
  getInstantNodeConnections,
  isInstantReady = false,
  isAtomicMode = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const isMobile = useIsMobile();
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // ENHANCED: Apply custom y-axis positioning for circle nodes
  const processedNodes = useMemo(() => {
    if (!data.nodes || data.nodes.length === 0) return [];

    // Separate entity (circle) and emotion (cube) nodes
    const entityNodes = data.nodes.filter(node => node.type === 'entity');
    const emotionNodes = data.nodes.filter(node => node.type === 'emotion');

    console.log(`[SimplifiedSoulNetVisualization] Processing ${entityNodes.length} entity nodes and ${emotionNodes.length} emotion nodes`);

    // Apply custom y-axis distances to entity nodes
    const processedEntityNodes = entityNodes.map((node, index) => {
      const customYDistance = getCircleNodeYDistance(index);
      const newPosition: [number, number, number] = [
        node.position[0], // keep x
        customYDistance,  // apply custom y pattern
        node.position[2]  // keep z
      ];
      
      console.log(`[SimplifiedSoulNetVisualization] Entity node ${index + 1} (${node.id}): y-distance = ${customYDistance}`);
      
      return {
        ...node,
        position: newPosition
      };
    });

    // Keep emotion nodes unchanged
    return [...processedEntityNodes, ...emotionNodes];
  }, [data.nodes]);

  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    
    const highlighted = new Set<string>([selectedNode]);
    
    data.links.forEach(link => {
      if (link.source === selectedNode) {
        highlighted.add(link.target);
      } else if (link.target === selectedNode) {
        highlighted.add(link.source);
      }
    });
    
    return highlighted;
  }, [selectedNode, data.links]);

  const handleNodeClick = useCallback((nodeId: string, event: any) => {
    if (onNodeClick) {
      onNodeClick(nodeId, event);
    }
  }, [onNodeClick]);

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setEffectiveTheme(isDark ? 'dark' : 'light');
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  useFrame((state) => {
    if (groupRef.current && !selectedNode) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  const getCoordinatedTranslation = useCallback((nodeId: string) => {
    if (getInstantTranslation) {
      return getInstantTranslation(nodeId);
    }
    return nodeId;
  }, [getInstantTranslation]);

  console.log(`[SimplifiedSoulNetVisualization] Rendering with ${processedNodes.length} processed nodes, selected: ${selectedNode}, atomic mode: ${isAtomicMode}`);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      
      <group ref={groupRef}>
        {processedNodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels}
            dimmed={selectedNode !== null && !highlightedNodes.has(node.id)}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={isFullScreen ? 40 : 45}
            isHighlighted={highlightedNodes.has(node.id)}
            connectionPercentage={selectedNode ? (getInstantConnectionPercentage?.(selectedNode, node.id) || 0) : 0}
            showPercentage={selectedNode !== null && selectedNode !== node.id}
            forceShowLabels={shouldShowLabels}
            effectiveTheme={effectiveTheme}
            isInstantMode={isAtomicMode}
            getCoordinatedTranslation={getCoordinatedTranslation}
          />
        ))}
        
        {data.links.map((link, index) => {
          const sourceNode = processedNodes.find(n => n.id === link.source);
          const targetNode = processedNodes.find(n => n.id === link.target);
          
          if (!sourceNode || !targetNode) return null;
          
          return (
            <Edge
              key={`${link.source}-${link.target}-${index}`}
              start={sourceNode.position}
              end={targetNode.position}
              value={link.value}
              isHighlighted={
                selectedNode !== null && 
                (link.source === selectedNode || link.target === selectedNode)
              }
              dimmed={
                selectedNode !== null && 
                link.source !== selectedNode && 
                link.target !== selectedNode
              }
              startNodeType={sourceNode.type}
              endNodeType={targetNode.type}
            />
          );
        })}
      </group>
    </>
  );
};

export default SimplifiedSoulNetVisualization;
