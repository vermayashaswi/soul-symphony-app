
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useInstantSoulNetData } from './useInstantSoulNetData';

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

interface ConnectionData {
  connectedNodes: Set<string>;
  connectionPercentages: Map<string, number>;
  connectionStrengths: Map<string, number>;
  totalConnections: number;
}

interface OptimizedNodeData extends NodeData {
  precomputedConnections: ConnectionData;
  precomputedScale: number;
  precomputedOpacity: number;
}

interface UseOptimizedSoulNetDataReturn {
  optimizedNodes: OptimizedNodeData[];
  originalLinks: LinkData[];
  loading: boolean;
  error: Error | null;
  isReady: boolean;
  getConnectionData: (nodeId: string) => ConnectionData;
  getInstantTranslation: (nodeId: string) => string;
}

export const useOptimizedSoulNetData = (
  userId: string | undefined,
  timeRange: string
): UseOptimizedSoulNetDataReturn => {
  const { 
    graphData, 
    loading, 
    error,
    isInstantReady,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  } = useInstantSoulNetData(userId, timeRange);

  const [optimizedNodes, setOptimizedNodes] = useState<OptimizedNodeData[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Pre-compute all connection data for instant access
  const connectionDataMap = useMemo(() => {
    const map = new Map<string, ConnectionData>();
    
    if (!graphData.nodes.length || !graphData.links.length) {
      return map;
    }

    console.log('[useOptimizedSoulNetData] Pre-computing connection data for all nodes');

    graphData.nodes.forEach(node => {
      // Get connected nodes
      const connectedNodes = new Set<string>();
      const connectionValues = new Map<string, number>();
      
      graphData.links.forEach(link => {
        if (link.source === node.id) {
          connectedNodes.add(link.target);
          connectionValues.set(link.target, link.value);
        } else if (link.target === node.id) {
          connectedNodes.add(link.source);
          connectionValues.set(link.source, link.value);
        }
      });

      // Calculate percentages
      const totalValue = Array.from(connectionValues.values()).reduce((sum, val) => sum + val, 0);
      const connectionPercentages = new Map<string, number>();
      
      if (totalValue > 0) {
        let runningSum = 0;
        const entries = Array.from(connectionValues.entries());
        
        entries.forEach(([connectedId, value], index) => {
          if (index === entries.length - 1) {
            const percentage = 100 - runningSum;
            connectionPercentages.set(connectedId, Math.max(1, percentage));
          } else {
            const percentage = Math.round((value / totalValue) * 100);
            connectionPercentages.set(connectedId, Math.max(1, percentage));
            runningSum += percentage;
          }
        });
      }

      // Calculate connection strengths
      const connectionStrengths = new Map<string, number>();
      if (connectionValues.size > 0) {
        const values = Array.from(connectionValues.values());
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue;
        
        connectionValues.forEach((value, connectedId) => {
          const normalizedStrength = range > 0 ? 0.3 + (0.7 * (value - minValue) / range) : 0.8;
          connectionStrengths.set(connectedId, normalizedStrength);
        });
      }

      map.set(node.id, {
        connectedNodes,
        connectionPercentages,
        connectionStrengths,
        totalConnections: connectedNodes.size
      });
    });

    console.log(`[useOptimizedSoulNetData] Pre-computed connection data for ${map.size} nodes`);
    return map;
  }, [graphData.nodes, graphData.links]);

  // Optimize nodes with pre-computed data
  useEffect(() => {
    if (!graphData.nodes.length || !isInstantReady) {
      return;
    }

    console.log('[useOptimizedSoulNetData] Creating optimized nodes with pre-computed data');

    const optimized = graphData.nodes.map(node => {
      const connectionData = connectionDataMap.get(node.id) || {
        connectedNodes: new Set(),
        connectionPercentages: new Map(),
        connectionStrengths: new Map(),
        totalConnections: 0
      };

      const baseScale = node.type === 'entity' ? 1.0 : 0.85;
      const baseOpacity = 0.8;

      return {
        ...node,
        precomputedConnections: connectionData,
        precomputedScale: baseScale,
        precomputedOpacity: baseOpacity
      };
    });

    setOptimizedNodes(optimized);
    setIsReady(true);
    
    console.log(`[useOptimizedSoulNetData] Optimization complete - ${optimized.length} nodes ready for instant rendering`);
  }, [graphData.nodes, connectionDataMap, isInstantReady]);

  const getConnectionData = useCallback((nodeId: string): ConnectionData => {
    return connectionDataMap.get(nodeId) || {
      connectedNodes: new Set(),
      connectionPercentages: new Map(),
      connectionStrengths: new Map(),
      totalConnections: 0
    };
  }, [connectionDataMap]);

  return {
    optimizedNodes,
    originalLinks: graphData.links,
    loading,
    error,
    isReady: isReady && isInstantReady,
    getConnectionData,
    getInstantTranslation
  };
};
