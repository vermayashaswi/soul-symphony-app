
import React, { useMemo } from 'react';

interface LinkData {
  source: string;
  target: string;
  value: number;
}

interface ConnectionData {
  nodeId: string;
  percentage: number;
  strength: number;
}

interface ConnectionCalculatorProps {
  selectedNodeId: string | null;
  links: LinkData[];
  children: (data: {
    connectedNodes: Set<string>;
    connectionData: Map<string, ConnectionData>;
    getConnectionPercentage: (nodeId: string) => number;
    getConnectionStrength: (nodeId: string) => number;
  }) => React.ReactNode;
}

export const ConnectionCalculator: React.FC<ConnectionCalculatorProps> = ({
  selectedNodeId,
  links,
  children
}) => {
  const connectionAnalysis = useMemo(() => {
    if (!selectedNodeId || !links.length) {
      return {
        connectedNodes: new Set<string>(),
        connectionData: new Map<string, ConnectionData>(),
        totalValue: 0
      };
    }

    console.log(`[ConnectionCalculator] Analyzing connections for ${selectedNodeId}`);

    // Find all links connected to the selected node
    const relevantLinks = links.filter(link => 
      link.source === selectedNodeId || link.target === selectedNodeId
    );

    if (relevantLinks.length === 0) {
      console.log(`[ConnectionCalculator] No connections found for ${selectedNodeId}`);
      return {
        connectedNodes: new Set<string>(),
        connectionData: new Map<string, ConnectionData>(),
        totalValue: 0
      };
    }

    // Calculate total connection value for percentage calculation
    const totalValue = relevantLinks.reduce((sum, link) => sum + link.value, 0);
    
    const connectedNodes = new Set<string>();
    const connectionData = new Map<string, ConnectionData>();

    // Process each connected node
    relevantLinks.forEach(link => {
      const connectedNodeId = link.source === selectedNodeId ? link.target : link.source;
      connectedNodes.add(connectedNodeId);
      
      // Calculate percentage (ensuring it adds up to 100%)
      const percentage = totalValue > 0 ? Math.round((link.value / totalValue) * 100) : 0;
      
      // Calculate relative strength (0.3 to 1.0 range)
      const maxValue = Math.max(...relevantLinks.map(l => l.value));
      const minValue = Math.min(...relevantLinks.map(l => l.value));
      const strength = maxValue > minValue 
        ? 0.3 + (0.7 * (link.value - minValue) / (maxValue - minValue))
        : 0.7;

      connectionData.set(connectedNodeId, {
        nodeId: connectedNodeId,
        percentage: Math.max(1, percentage), // Minimum 1%
        strength
      });
    });

    // Add the selected node to connected nodes (it should highlight too)
    connectedNodes.add(selectedNodeId);

    console.log(`[ConnectionCalculator] Found ${connectedNodes.size} connected nodes for ${selectedNodeId}:`, 
      Array.from(connectionData.entries()).map(([id, data]) => `${id}: ${data.percentage}%`)
    );

    return { connectedNodes, connectionData, totalValue };
  }, [selectedNodeId, links]);

  const getConnectionPercentage = useCallback((nodeId: string): number => {
    const data = connectionAnalysis.connectionData.get(nodeId);
    return data?.percentage || 0;
  }, [connectionAnalysis.connectionData]);

  const getConnectionStrength = useCallback((nodeId: string): number => {
    const data = connectionAnalysis.connectionData.get(nodeId);
    return data?.strength || 0.5;
  }, [connectionAnalysis.connectionData]);

  return (
    <>
      {children({
        connectedNodes: connectionAnalysis.connectedNodes,
        connectionData: connectionAnalysis.connectionData,
        getConnectionPercentage,
        getConnectionStrength
      })}
    </>
  );
};

export default ConnectionCalculator;
