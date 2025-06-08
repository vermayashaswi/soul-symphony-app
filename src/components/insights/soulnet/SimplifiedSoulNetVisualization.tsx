
import React, { useMemo, useCallback, useState } from 'react';
import { Line } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import TranslatableText3D from './TranslatableText3D';
import FixedConnectionPercentage from './FixedConnectionPercentage';

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

interface SimplifiedSoulNetVisualizationProps {
  data: { nodes: NodeData[], links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen: boolean;
  shouldShowLabels: boolean;
  getInstantConnectionPercentage?: (sourceId: string, targetId: string) => number;
  getInstantTranslation?: (text: string) => string;
  getInstantNodeConnections?: (nodeId: string) => LinkData[];
  isInstantReady?: boolean;
}

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
  isInstantReady = false
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Enhanced node position mapping with instant access
  const nodePositions = useMemo(() => {
    const positions = new Map<string, [number, number, number]>();
    data.nodes.forEach(node => {
      positions.set(node.id, node.position);
    });
    return positions;
  }, [data.nodes]);

  // Enhanced connection filtering with instant data
  const visibleLinks = useMemo(() => {
    if (!selectedNode) return data.links;
    
    // Use instant node connections if available
    if (getInstantNodeConnections && isInstantReady) {
      return getInstantNodeConnections(selectedNode);
    }
    
    // Fallback to manual filtering
    return data.links.filter(link => 
      link.source === selectedNode || link.target === selectedNode
    );
  }, [data.links, selectedNode, getInstantNodeConnections, isInstantReady]);

  // Enhanced node click handler with instant feedback
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log(`[SimplifiedSoulNetVisualization] Enhanced node click: ${nodeId}`);
    onNodeClick(nodeId);
  }, [onNodeClick]);

  // Enhanced node hover handlers
  const handleNodeHover = useCallback((nodeId: string) => {
    setHoveredNode(nodeId);
  }, []);

  const handleNodeUnhover = useCallback(() => {
    setHoveredNode(null);
  }, []);

  console.log(`[SimplifiedSoulNetVisualization] Enhanced rendering with ${data.nodes.length} nodes, ${visibleLinks.length} visible links, isInstantReady: ${isInstantReady}`);

  return (
    <>
      {/* Enhanced Nodes Rendering */}
      {data.nodes.map((node) => {
        const isSelected = selectedNode === node.id;
        const isHovered = hoveredNode === node.id;
        const isHighlighted = isSelected || isHovered;
        const nodeColor = node.type === 'entity' ? themeHex : '#ff6b6b';
        const scale = isHighlighted ? 1.3 : 1.0;
        const opacity = selectedNode && !isHighlighted ? 0.3 : 1.0;

        return (
          <group key={node.id} position={node.position}>
            <mesh
              scale={scale}
              onClick={() => handleNodeClick(node.id)}
              onPointerEnter={() => handleNodeHover(node.id)}
              onPointerLeave={handleNodeUnhover}
            >
              <sphereGeometry args={[node.value * 0.8, 16, 16]} />
              <meshStandardMaterial
                color={nodeColor}
                transparent
                opacity={opacity}
                emissive={isHighlighted ? nodeColor : '#000000'}
                emissiveIntensity={isHighlighted ? 0.3 : 0}
              />
            </mesh>

            {/* Enhanced Node Labels with Instant Translation */}
            {shouldShowLabels && (
              <TranslatableText3D
                text={node.id}
                position={[0, -1.2, 0]}
                color="#ffffff"
                size={isFullScreen ? 0.35 : 0.3}
                visible={true}
                renderOrder={100}
                bold={true}
                outlineWidth={0.08}
                outlineColor="#000000"
                maxWidth={15}
                enableWrapping={true}
                maxCharsPerLine={12}
                maxLines={2}
                getInstantTranslation={getInstantTranslation}
                isInstantReady={isInstantReady}
              />
            )}

            {/* Enhanced Connection Percentages with Instant Data */}
            {isSelected && visibleLinks.map((link) => {
              const isSource = link.source === node.id;
              const isTarget = link.target === node.id;
              
              if (!isSource && !isTarget) return null;

              const percentage = getInstantConnectionPercentage 
                ? getInstantConnectionPercentage(link.source, link.target)
                : Math.round((link.value / 1.0) * 100);

              return (
                <FixedConnectionPercentage
                  key={`${link.source}-${link.target}-${node.id}`}
                  position={[0, 1.5, 0]}
                  percentage={percentage}
                  isVisible={percentage > 0}
                  nodeType={node.type}
                />
              );
            })}
          </group>
        );
      })}

      {/* Enhanced Links Rendering */}
      {visibleLinks.map((link) => {
        const sourcePos = nodePositions.get(link.source);
        const targetPos = nodePositions.get(link.target);
        
        if (!sourcePos || !targetPos) return null;

        const linkOpacity = selectedNode ? 0.8 : 0.4;
        const linkWidth = Math.max(0.02, link.value * 0.15);

        return (
          <Line
            key={`${link.source}-${link.target}`}
            points={[sourcePos, targetPos]}
            color={themeHex}
            lineWidth={linkWidth}
            transparent
            opacity={linkOpacity}
          />
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
