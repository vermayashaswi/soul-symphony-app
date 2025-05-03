
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import NodeObject from './NodeObject';
import ConnectionLine from './ConnectionLine';
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

interface SoulNetVisualizationProps {
  data: {
    nodes: NodeData[];
    links: LinkData[];
  };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen: boolean;
  translatedLabels: Map<string, string>;
}

const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  translatedLabels
}) => {
  const orbitControlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(0);
  const isMobile = useIsMobile();
  
  // Track all highlighted connection IDs
  const highlightedConnections = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    
    const connections = new Set<string>();
    data.links.forEach(link => {
      if (link.source === selectedNode || link.target === selectedNode) {
        connections.add(`${link.source}-${link.target}`);
      }
    });
    
    return connections;
  }, [selectedNode, data.links]);

  // Get connection percentage for a node pair
  const getConnectionPercentage = useCallback((sourceId: string, targetId: string): number => {
    const link = data.links.find(
      l => (l.source === sourceId && l.target === targetId) || 
           (l.source === targetId && l.target === sourceId)
    );
    
    return link ? Math.round(link.value * 100) : 0;
  }, [data.links]);

  // Update camera zoom for responsive sizing
  useFrame(({ camera }) => {
    if (camera instanceof THREE.PerspectiveCamera) {
      setCameraZoom(camera.position.z);
    }
  });

  // Optimize for mobile
  useEffect(() => {
    if (orbitControlsRef.current) {
      // Adjust sensitivity for mobile
      orbitControlsRef.current.rotateSpeed = isMobile ? 0.7 : 1;
      orbitControlsRef.current.panSpeed = isMobile ? 0.7 : 1;
      orbitControlsRef.current.zoomSpeed = isMobile ? 0.7 : 1;
    }
  }, [isMobile, orbitControlsRef.current]);

  // Clean up emotion text for better translation
  const normalizeEmotionText = (text: string): string => {
    if (!text) return '';
    
    // Handle special cases that might cause translation issues
    let normalized = text.replace(/[0-9.]+%?/g, '').trim(); // Remove any numbers and percentages
    normalized = normalized.replace(/[_\-+]/g, ' '); // Replace underscores and hyphens with spaces
    normalized = normalized.replace(/\s{2,}/g, ' '); // Replace multiple spaces with a single space
    
    // Capitalize first letter for consistency
    if (normalized.length > 0) {
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
    }
    
    return normalized || text; // Return original if normalization results in empty string
  };

  // Get translated text for a node
  const getTranslatedText = (node: NodeData): string | undefined => {
    const nodeId = node.id;
    
    // For emotion nodes, we want to normalize the text before looking up translation
    const lookupKey = node.type === 'emotion' ? normalizeEmotionText(nodeId) : nodeId;
    
    // First try exact match
    if (translatedLabels.has(nodeId)) {
      return translatedLabels.get(nodeId);
    }
    
    // Then try normalized version
    if (lookupKey !== nodeId && translatedLabels.has(lookupKey)) {
      return translatedLabels.get(lookupKey);
    }
    
    // Debug logging for missing translations
    if (node.type === 'emotion') {
      console.log(`No translation found for emotion: "${nodeId}", normalized as "${lookupKey}"`);
    }
    
    // Return the original ID if no translation found
    return nodeId;
  };

  // Helper to check if a node should be highlighted
  const isNodeHighlighted = (nodeId: string): boolean => {
    if (!selectedNode) return false;
    if (nodeId === selectedNode) return true;
    
    return data.links.some(link => 
      (link.source === selectedNode && link.target === nodeId) ||
      (link.target === selectedNode && link.source === nodeId)
    );
  };

  return (
    <>
      <OrbitControls
        ref={orbitControlsRef}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.8}
        maxPolarAngle={Math.PI * 0.6}
        minPolarAngle={Math.PI * 0.15}
        enablePan={isFullScreen}
        screenSpacePanning
        minDistance={8}
        maxDistance={isFullScreen ? 50 : 35}
      />
      
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <ambientLight intensity={0.4} />
      
      {/* Render connections first so they appear behind nodes */}
      {data.links.map(link => {
        // Find the source and target nodes
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        
        if (!sourceNode || !targetNode) return null;
        
        const connectionId = `${link.source}-${link.target}`;
        const isHighlighted = highlightedConnections.has(connectionId);
        
        return (
          <ConnectionLine
            key={connectionId}
            start={sourceNode.position}
            end={targetNode.position}
            isHighlighted={isHighlighted}
            strength={link.value}
            isHidden={!!selectedNode && !isHighlighted}
            sourceType={sourceNode.type}
            targetType={targetNode.type}
            themeHex={themeHex}
          />
        );
      })}
      
      {/* Render nodes on top of connections */}
      {data.nodes.map(node => {
        const isHighlighted = isNodeHighlighted(node.id);
        const shouldShowLabel = !selectedNode || isHighlighted;
        const isHidden = !!selectedNode && !isHighlighted && node.id !== selectedNode;
        const translatedText = getTranslatedText(node);
        
        return (
          <NodeObject
            key={node.id}
            id={node.id}
            position={node.position}
            color={node.type === 'entity' ? '#ffffff' : themeHex}
            size={node.value * (node.type === 'entity' ? 1.2 : 1.0)}
            type={node.type}
            isHighlighted={isHighlighted}
            isSelected={node.id === selectedNode}
            isHidden={isHidden}
            showLabel={shouldShowLabel}
            onClick={() => onNodeClick(node.id)}
            cameraZoom={cameraZoom}
            themeHex={themeHex}
            translatedText={translatedText}
          />
        );
      })}
      
      {/* Connection percentage labels rendered last to appear on top */}
      {selectedNode && data.links
        .filter(link => link.source === selectedNode || link.target === selectedNode)
        .map(link => {
          const sourceNode = data.nodes.find(n => n.id === link.source);
          const targetNode = data.nodes.find(n => n.id === link.target);
          
          if (!sourceNode || !targetNode) return null;
          
          // Position percentage halfway between connected nodes
          const midPoint: [number, number, number] = [
            (sourceNode.position[0] + targetNode.position[0]) / 2,
            (sourceNode.position[1] + targetNode.position[1]) / 2,
            (sourceNode.position[2] + targetNode.position[2]) / 2
          ];
          
          // Determine if this node is the target or source of the connection
          const otherNodeId = link.source === selectedNode ? link.target : link.source;
          const otherNode = data.nodes.find(n => n.id === otherNodeId);
          
          if (!otherNode) return null;
          
          return (
            <group key={`${link.source}-${link.target}-pct`} position={midPoint}>
              <NodeObject 
                id={`${link.source}-${link.target}-pct`}
                position={[0, 0, 0]}
                color="transparent"
                size={0.1}
                type="connection"
                isHighlighted={false}
                isHidden={false}
                showLabel={true}
                percentage={Math.round(link.value * 100)}
                nodeType={otherNode.type}
              />
            </group>
          );
        })}
    </>
  );
};

export default React.memo(SoulNetVisualization);

function useCallback(arg0: (sourceId: string, targetId: string) => number, arg1: unknown[]) {
  return useMemo(() => arg0, arg1);
}
