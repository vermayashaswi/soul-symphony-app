
import React, { useMemo } from 'react';

interface TextItem {
  id: string;
  text: string;
  position: [number, number, number];
  color: string;
  size: number;
  visible: boolean;
  bold: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  nodeType: 'entity' | 'emotion';
}

interface SimpleTextServiceProps {
  nodes: Array<{
    id: string;
    type: 'entity' | 'emotion';
    position: [number, number, number];
  }>;
  selectedNode: string | null;
  highlightedNodes: Set<string>;
  theme: string;
  cameraZoom: number;
  shouldShowLabels: boolean;
}

export const useSimpleTextItems = ({
  nodes,
  selectedNode,
  highlightedNodes,
  theme,
  cameraZoom,
  shouldShowLabels
}: SimpleTextServiceProps): TextItem[] => {
  return useMemo(() => {
    if (!shouldShowLabels || nodes.length === 0) return [];

    return nodes.map(node => {
      const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
      
      const getTextColor = () => {
        if (selectedNode === node.id) {
          return theme === 'light' ? '#000000' : '#ffffff';
        }
        
        if (isHighlighted) {
          return node.type === 'emotion' 
            ? (theme === 'light' ? '#2563eb' : '#60a5fa')
            : (theme === 'light' ? '#dc2626' : '#f87171');
        }
        
        return theme === 'light' ? '#666666' : '#999999';
      };

      const getLabelOffset = (): [number, number, number] => {
        const geometricOffset = node.type === 'entity' 
          ? 1.4 * 1.3
          : Math.sqrt(3) * (2.1 / 2) * 1.3;
        
        return [
          node.position[0], 
          node.position[1] + geometricOffset, 
          node.position[2]
        ];
      };

      const baseSize = 0.35;
      const zoomFactor = Math.max(0, (45 - cameraZoom) * 0.007);
      const calculatedSize = baseSize + zoomFactor;
      const finalSize = isFinite(calculatedSize) ? calculatedSize : baseSize;

      return {
        id: node.id,
        text: node.id, // Use node ID directly, no translation
        position: getLabelOffset(),
        color: getTextColor(),
        size: finalSize,
        visible: true,
        bold: isHighlighted || selectedNode === node.id,
        isHighlighted,
        isSelected: selectedNode === node.id,
        nodeType: node.type
      };
    });
  }, [nodes, selectedNode, highlightedNodes, theme, cameraZoom, shouldShowLabels]);
};
