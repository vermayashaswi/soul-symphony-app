
import React, { useState, useCallback, useEffect } from 'react';

interface NodeSelectionManagerProps {
  children: (state: {
    selectedNodeId: string | null;
    handleNodeSelect: (nodeId: string) => void;
    clearSelection: () => void;
  }) => React.ReactNode;
}

export const NodeSelectionManager: React.FC<NodeSelectionManagerProps> = ({ children }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleNodeSelect = useCallback((nodeId: string) => {
    console.log(`[NodeSelectionManager] Node selection request: ${nodeId}`, {
      currentSelection: selectedNodeId,
      willToggle: selectedNodeId === nodeId
    });

    setSelectedNodeId(prevSelected => {
      if (prevSelected === nodeId) {
        console.log(`[NodeSelectionManager] Deselecting node ${nodeId}`);
        return null;
      } else {
        console.log(`[NodeSelectionManager] Selecting node ${nodeId}`);
        return nodeId;
      }
    });
  }, [selectedNodeId]);

  const clearSelection = useCallback(() => {
    console.log(`[NodeSelectionManager] Clearing selection`);
    setSelectedNodeId(null);
  }, []);

  // Log state changes
  useEffect(() => {
    console.log(`[NodeSelectionManager] Selection state changed to: ${selectedNodeId}`);
  }, [selectedNodeId]);

  return (
    <>
      {children({
        selectedNodeId,
        handleNodeSelect,
        clearSelection
      })}
    </>
  );
};

export default NodeSelectionManager;
