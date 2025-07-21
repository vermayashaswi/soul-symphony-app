
import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

interface NodeStateContextType {
  selectedNodeId: string | null;
  highlightedNodes: Set<string>;
  dimmedNodes: Set<string>;
  selectNode: (nodeId: string | null) => void;
  isNodeSelected: (nodeId: string) => boolean;
  isNodeHighlighted: (nodeId: string) => boolean;
  isNodeDimmed: (nodeId: string) => boolean;
  getConnectionPercentage: (nodeId: string) => number;
  clearSelection: () => void;
}

const NodeStateContext = createContext<NodeStateContextType | undefined>(undefined);

interface NodeStateProviderProps {
  children: React.ReactNode;
  graphData: {
    nodes: Array<{ id: string; type: 'entity' | 'emotion'; position: [number, number, number] }>;
    links: Array<{ source: string; target: string; value: number }>;
  };
  getInstantConnectionPercentage?: (selectedNode: string, targetNode: string) => number;
  getInstantNodeConnections?: (nodeId: string) => any;
  isInstantReady?: boolean;
}

export const NodeStateProvider: React.FC<NodeStateProviderProps> = ({
  children,
  graphData,
  getInstantConnectionPercentage = () => 0,
  getInstantNodeConnections = () => ({ connectedNodes: [], totalStrength: 0 }),
  isInstantReady = false
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimmedNodes, setDimmedNodes] = useState<Set<string>>(new Set());

  // Update highlighting when selection changes
  useEffect(() => {
    console.log(`[NodeState] Selection changed: ${selectedNodeId}`);
    
    if (selectedNodeId) {
      const connectedNodes = new Set<string>();
      const allOtherNodes = new Set<string>();
      
      // Use instant connection data if available
      if (isInstantReady) {
        const connectionData = getInstantNodeConnections(selectedNodeId);
        connectionData.connectedNodes.forEach((nodeId: string) => {
          connectedNodes.add(nodeId);
        });
        connectedNodes.add(selectedNodeId);
        
        console.log(`[NodeState] Using instant connections for ${selectedNodeId}:`, connectionData.connectedNodes);
      } else {
        // Fallback to link traversal
        graphData.links.forEach(link => {
          if (link.source === selectedNodeId || link.target === selectedNodeId) {
            connectedNodes.add(link.source);
            connectedNodes.add(link.target);
          }
        });
        
        console.log(`[NodeState] Using link traversal for ${selectedNodeId}`);
      }
      
      // All nodes that are NOT connected become dimmed
      graphData.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
      
      console.log(`[NodeState] Highlighting ${connectedNodes.size} nodes, dimming ${allOtherNodes.size} nodes`);
    } else {
      setHighlightedNodes(new Set());
      setDimmedNodes(new Set());
      console.log('[NodeState] Clearing all highlighting');
    }
  }, [selectedNodeId, graphData.links, graphData.nodes, isInstantReady, getInstantNodeConnections]);

  const selectNode = useCallback((nodeId: string | null) => {
    console.log(`[NodeState] Node selection requested: ${nodeId}`);
    
    if (selectedNodeId === nodeId) {
      console.log(`[NodeState] Deselecting node: ${nodeId}`);
      setSelectedNodeId(null);
    } else {
      console.log(`[NodeState] Selecting node: ${nodeId}`);
      setSelectedNodeId(nodeId);
    }
  }, [selectedNodeId]);

  const isNodeSelected = useCallback((nodeId: string) => {
    return selectedNodeId === nodeId;
  }, [selectedNodeId]);

  const isNodeHighlighted = useCallback((nodeId: string) => {
    return highlightedNodes.has(nodeId);
  }, [highlightedNodes]);

  const isNodeDimmed = useCallback((nodeId: string) => {
    return dimmedNodes.has(nodeId);
  }, [dimmedNodes]);

  const getConnectionPercentage = useCallback((nodeId: string) => {
    if (!selectedNodeId || !isNodeHighlighted(nodeId) || nodeId === selectedNodeId) {
      return 0;
    }
    
    return getInstantConnectionPercentage(selectedNodeId, nodeId);
  }, [selectedNodeId, isNodeHighlighted, getInstantConnectionPercentage]);

  const clearSelection = useCallback(() => {
    console.log('[NodeState] Clearing selection');
    setSelectedNodeId(null);
  }, []);

  const value: NodeStateContextType = {
    selectedNodeId,
    highlightedNodes,
    dimmedNodes,
    selectNode,
    isNodeSelected,
    isNodeHighlighted,
    isNodeDimmed,
    getConnectionPercentage,
    clearSelection
  };

  return (
    <NodeStateContext.Provider value={value}>
      {children}
    </NodeStateContext.Provider>
  );
};

export const useNodeState = () => {
  const context = useContext(NodeStateContext);
  if (context === undefined) {
    throw new Error('useNodeState must be used within a NodeStateProvider');
  }
  return context;
};
