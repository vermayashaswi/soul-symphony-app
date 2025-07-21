
import React, { useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';

interface NodeSelectionState {
  selectedNodeId: string | null;
  selectedPosition: THREE.Vector3 | null;
  highlightedNodes: Set<string>;
  connectionPercentages: Map<string, number>;
  animationStartTime: number;
}

interface NodeSelectionManagerProps {
  nodes: Array<{ id: string; position: THREE.Vector3 }>;
  links: Array<{ source: string; target: string; strength: number }>;
  connectionStrengths: Map<string, number>;
  children: (state: NodeSelectionState & {
    onNodeSelect: (nodeId: string, position: THREE.Vector3) => void;
    onNodeDeselect: () => void;
  }) => React.ReactNode;
}

export const NodeSelectionManager: React.FC<NodeSelectionManagerProps> = ({
  nodes,
  links,
  connectionStrengths,
  children
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<THREE.Vector3 | null>(null);
  const [animationStartTime, setAnimationStartTime] = useState(0);

  const { highlightedNodes, connectionPercentages } = useMemo(() => {
    if (!selectedNodeId) {
      return {
        highlightedNodes: new Set<string>(),
        connectionPercentages: new Map<string, number>()
      };
    }

    const highlighted = new Set<string>();
    const percentages = new Map<string, number>();

    // Find all connections for the selected node
    for (const link of links) {
      let connectedNodeId: string | null = null;
      let strength = 0;

      if (link.source === selectedNodeId) {
        connectedNodeId = link.target;
        strength = link.strength;
      } else if (link.target === selectedNodeId) {
        connectedNodeId = link.source;
        strength = link.strength;
      }

      if (connectedNodeId) {
        highlighted.add(connectedNodeId);
        percentages.set(connectedNodeId, strength);
      }
    }

    // Always highlight the selected node itself
    highlighted.add(selectedNodeId);

    console.log('[NodeSelectionManager] Updated selection state:', {
      selectedNodeId,
      highlightedNodesCount: highlighted.size,
      connectionPercentagesCount: percentages.size,
      highlightedNodes: Array.from(highlighted),
      connectionPercentages: Array.from(percentages.entries())
    });

    return {
      highlightedNodes: highlighted,
      connectionPercentages: percentages
    };
  }, [selectedNodeId, links]);

  const handleNodeSelect = useCallback((nodeId: string, position: THREE.Vector3) => {
    console.log('[NodeSelectionManager] Node selected:', { nodeId, position });
    
    setSelectedNodeId(nodeId);
    setSelectedPosition(position.clone());
    setAnimationStartTime(Date.now());

    // Haptic feedback for native apps
    if ((window as any).Capacitor) {
      try {
        const { Haptics } = (window as any).Capacitor.Plugins;
        if (Haptics) {
          Haptics.impact({ style: 'LIGHT' });
        }
      } catch (error) {
        console.warn('[NodeSelectionManager] Haptic feedback failed:', error);
      }
    }
  }, []);

  const handleNodeDeselect = useCallback(() => {
    console.log('[NodeSelectionManager] Node deselected');
    
    setSelectedNodeId(null);
    setSelectedPosition(null);
    setAnimationStartTime(0);
  }, []);

  const state: NodeSelectionState = {
    selectedNodeId,
    selectedPosition,
    highlightedNodes,
    connectionPercentages,
    animationStartTime
  };

  return (
    <>
      {children({
        ...state,
        onNodeSelect: handleNodeSelect,
        onNodeDeselect: handleNodeDeselect
      })}
    </>
  );
};
