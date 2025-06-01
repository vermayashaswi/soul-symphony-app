
import React, { useRef, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface NodeData {
  id: string;
  type: 'entity' | 'emotion';
  value: number;
  color: string;
  position: [number, number, number];
}

interface HtmlLabelOverlayProps {
  nodes: NodeData[];
  selectedNode: string | null;
  highlightedNodes: Set<string>;
  shouldShowLabels: boolean;
  connectionPercentages: Map<string, number>;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface LabelPosition {
  x: number;
  y: number;
  visible: boolean;
  distance: number;
}

export const HtmlLabelOverlay: React.FC<HtmlLabelOverlayProps> = ({
  nodes,
  selectedNode,
  highlightedNodes,
  shouldShowLabels,
  connectionPercentages,
  containerRef
}) => {
  const { camera, size } = useThree();
  const [labelPositions, setLabelPositions] = useState<Map<string, LabelPosition>>(new Map());
  const requestRef = useRef<number>();
  
  // Calculate 2D screen positions for 3D world positions
  const calculateScreenPosition = (worldPosition: [number, number, number]): LabelPosition => {
    if (!camera || !size) {
      return { x: 0, y: 0, visible: false, distance: 0 };
    }
    
    const vector = new THREE.Vector3(...worldPosition);
    const distance = camera.position.distanceTo(vector);
    
    // Project to screen coordinates
    vector.project(camera);
    
    // Convert to pixel coordinates
    const x = (vector.x * 0.5 + 0.5) * size.width;
    const y = (vector.y * -0.5 + 0.5) * size.height;
    
    // Check if position is behind camera or outside frustum
    const visible = vector.z < 1 && vector.z > -1;
    
    return { x, y, visible, distance };
  };
  
  // Update label positions on camera changes
  const updateLabelPositions = () => {
    if (!shouldShowLabels || !nodes.length) {
      setLabelPositions(new Map());
      return;
    }
    
    const newPositions = new Map<string, LabelPosition>();
    
    nodes.forEach(node => {
      const shouldShow = selectedNode === node.id || 
                        highlightedNodes.has(node.id) || 
                        selectedNode === null;
                        
      if (shouldShow && Array.isArray(node.position)) {
        const screenPos = calculateScreenPosition(node.position);
        newPositions.set(node.id, screenPos);
      }
    });
    
    setLabelPositions(newPositions);
  };
  
  // Update positions on every frame
  useEffect(() => {
    const animate = () => {
      updateLabelPositions();
      requestRef.current = requestAnimationFrame(animate);
    };
    
    if (shouldShowLabels && nodes.length > 0) {
      requestRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [shouldShowLabels, nodes, selectedNode, highlightedNodes, camera, size]);
  
  if (!shouldShowLabels || !containerRef.current) {
    return null;
  }
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {nodes.map(node => {
        const position = labelPositions.get(node.id);
        const isSelected = selectedNode === node.id;
        const isHighlighted = highlightedNodes.has(node.id);
        const showPercentage = selectedNode !== null && 
                              highlightedNodes.has(node.id) && 
                              node.id !== selectedNode;
        const percentage = connectionPercentages.get(node.id) || 0;
        
        // Don't render if position not calculated or not visible
        if (!position || !position.visible) {
          return null;
        }
        
        // Scale based on distance - closer nodes get larger text
        const scale = Math.max(0.7, Math.min(1.5, 50 / Math.max(position.distance, 10)));
        const fontSize = Math.round(12 * scale);
        const maxWidth = Math.round(150 * scale);
        
        return (
          <div
            key={`label-${node.id}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none"
            style={{
              left: position.x,
              top: position.y,
              fontSize: `${fontSize}px`,
              maxWidth: `${maxWidth}px`,
              zIndex: isSelected ? 1000 : (isHighlighted ? 900 : 800),
              textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8), -1px 1px 2px rgba(0,0,0,0.8)',
              opacity: isSelected ? 1 : (isHighlighted ? 0.9 : 0.7),
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformOrigin: 'center',
              transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
            }}
          >
            <div
              className={`
                font-medium leading-tight break-words
                ${isSelected ? 'text-white' : 'text-gray-100'}
                ${node.type === 'entity' ? 'font-semibold' : 'font-normal'}
              `}
              style={{
                fontFamily: node.id.match(/[\u0900-\u097F]/) 
                  ? "'Noto Sans Devanagari', sans-serif" 
                  : "'Inter', sans-serif",
                lineHeight: node.id.match(/[\u0900-\u097F]/) ? '1.6' : '1.4',
                letterSpacing: node.id.match(/[\u0900-\u097F]/) ? '0.5px' : 'normal'
              }}
            >
              <TranslatableText 
                text={node.id} 
                forceTranslate={true}
              />
            </div>
            
            {showPercentage && percentage > 0 && (
              <div 
                className="text-xs font-medium text-blue-200 mt-1"
                style={{
                  fontSize: `${Math.round(10 * scale)}px`,
                  textShadow: '1px 1px 1px rgba(0,0,0,0.6)'
                }}
              >
                {percentage.toFixed(1)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HtmlLabelOverlay;
