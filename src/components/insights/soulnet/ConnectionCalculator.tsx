import React, { useMemo } from 'react';

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface ConnectionCalculatorProps {
  selectedNodeId: string | null;
  links: LinkData[];
  children: (state: {
    connectedNodes: Set<string>;
    getConnectionPercentage: (nodeId: string) => number;
    getConnectionStrength: (nodeId: string) => number;
  }) => React.ReactNode;
}

const ConnectionCalculator: React.FC<ConnectionCalculatorProps> = ({
  selectedNodeId,
  links,
  children
}) => {
  const { connectedNodes, getConnectionPercentage, getConnectionStrength } = useMemo(() => {
    const connectedNodes = new Set<string>();
    const connectionMap = new Map<string, number>();
    
    if (selectedNodeId) {
      // Add the selected node itself
      connectedNodes.add(selectedNodeId);
      
      // Find all connected nodes
      links.forEach(link => {
        if (link.source === selectedNodeId) {
          connectedNodes.add(link.target);
          connectionMap.set(link.target, link.value);
        } else if (link.target === selectedNodeId) {
          connectedNodes.add(link.source);
          connectionMap.set(link.source, link.value);
        }
      });
    }
    
    const getConnectionPercentage = (nodeId: string): number => {
      return connectionMap.get(nodeId) || 0;
    };
    
    const getConnectionStrength = (nodeId: string): number => {
      return connectionMap.get(nodeId) || 0.5;
    };
    
    return {
      connectedNodes,
      getConnectionPercentage,
      getConnectionStrength
    };
  }, [selectedNodeId, links]);

  return (
    <>
      {children({
        connectedNodes,
        getConnectionPercentage,
        getConnectionStrength
      })}
    </>
  );
};

export default ConnectionCalculator;