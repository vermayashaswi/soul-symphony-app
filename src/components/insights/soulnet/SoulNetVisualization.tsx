
import React, { useRef, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import EntityNode from './EntityNode';
import EmotionNode from './EmotionNode';
import NodeConnection from './NodeConnection';
import { useIsMobile } from '@/hooks/use-mobile';
import NodeLabel from './NodeLabel';

interface SoulNetVisualizationProps {
  data: {
    nodes: {
      id: string;
      type: 'entity' | 'emotion';
      position: [number, number, number];
      value: number;
      color: string;
    }[];
    links: {
      source: string;
      target: string;
      value: number;
    }[];
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
  const { camera } = useThree();
  const isMobile = useIsMobile();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const distanceToOrigin = useRef<number>(0);

  useEffect(() => {
    cameraRef.current = camera as THREE.PerspectiveCamera;
    // Track distance to adjust label visibility
    distanceToOrigin.current = new THREE.Vector3().distanceTo(camera.position);

    // Handle camera movement to adjust label visibility
    const updateCameraPosition = () => {
      if (cameraRef.current) {
        distanceToOrigin.current = new THREE.Vector3().distanceTo(cameraRef.current.position);
      }
    };

    // Add listener for camera movements
    window.addEventListener('cameraUpdate', updateCameraPosition as EventListener);

    return () => {
      window.removeEventListener('cameraUpdate', updateCameraPosition as EventListener);
    };
  }, [camera]);

  // Create a lookup for node positions for faster access
  const nodePositions = useMemo(() => {
    const positions = new Map<string, [number, number, number]>();
    data.nodes.forEach(node => {
      positions.set(node.id, node.position);
    });
    return positions;
  }, [data.nodes]);

  // Process links to correctly reference source and target nodes
  const processedLinks = useMemo(() => {
    return data.links.filter(link => {
      // Only include links where both source and target exist in the nodes
      const sourceExists = nodePositions.has(link.source);
      const targetExists = nodePositions.has(link.target);
      return sourceExists && targetExists;
    }).map(link => ({
      ...link,
      sourcePosition: nodePositions.get(link.source) as [number, number, number],
      targetPosition: nodePositions.get(link.target) as [number, number, number],
    }));
  }, [data.links, nodePositions]);

  // Calculate the zoom level based on camera position
  const cameraZoom = useMemo(() => {
    return distanceToOrigin.current;
  }, [distanceToOrigin.current]);

  // Debug translated labels availability
  useEffect(() => {
    if (translatedLabels.size > 0) {
      console.log(`SoulNetVisualization: ${translatedLabels.size} translated labels available`);
    }
  }, [translatedLabels]);

  return (
    <>
      {/* Render connections between nodes */}
      {processedLinks.map((link, index) => (
        <NodeConnection
          key={`link-${link.source}-${link.target}`}
          source={link.sourcePosition}
          target={link.targetPosition}
          strength={link.value}
          isHighlighted={
            selectedNode === link.source || selectedNode === link.target
          }
          themeHex={themeHex}
        />
      ))}

      {/* Render all nodes with their labels */}
      {data.nodes.map(node => {
        const isSelected = selectedNode === node.id;
        const isConnected = selectedNode
          ? processedLinks.some(
              link =>
                (link.source === selectedNode && link.target === node.id) ||
                (link.target === selectedNode && link.source === node.id)
            )
          : false;
        
        const isHighlighted = isSelected || isConnected;
        const translatedLabel = translatedLabels.get(node.id);
        
        // Only show labels when zoomed in or node is highlighted
        const shouldShowLabel = isFullScreen || 
                               isHighlighted || 
                               cameraZoom < (isMobile ? 50 : 40);

        return (
          <React.Fragment key={node.id}>
            {node.type === 'entity' ? (
              <EntityNode
                position={node.position}
                size={node.value * (isHighlighted ? 1.2 : 1)}
                onClick={() => onNodeClick(node.id)}
                isHighlighted={isHighlighted}
                themeHex={themeHex}
              />
            ) : (
              <EmotionNode
                position={node.position}
                size={node.value * (isHighlighted ? 1.2 : 1)}
                onClick={() => onNodeClick(node.id)}
                isHighlighted={isHighlighted}
                themeHex={themeHex}
              />
            )}
            <NodeLabel
              id={node.id}
              type={node.type}
              position={node.position}
              isHighlighted={isHighlighted}
              shouldShowLabel={shouldShowLabel}
              cameraZoom={cameraZoom}
              themeHex={themeHex}
              translatedText={translatedLabel}
            />
          </React.Fragment>
        );
      })}
    </>
  );
};

export default SoulNetVisualization;
