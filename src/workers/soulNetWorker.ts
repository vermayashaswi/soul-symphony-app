
// Web Worker for Soul-Net background processing
interface SoulNetWorkerMessage {
  type: 'CALCULATE_PERCENTAGES' | 'PREPROCESS_TRANSLATIONS' | 'OPTIMIZE_POSITIONS';
  payload: any;
}

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

// Calculate connection percentages for all node pairs
function calculateAllConnectionPercentages(
  nodes: NodeData[],
  links: LinkData[]
): Map<string, number> {
  console.log('[SoulNetWorker] Calculating connection percentages for', nodes.length, 'nodes');
  
  const percentageMap = new Map<string, number>();
  const nodeConnectionTotals = new Map<string, number>();
  
  // Calculate total connection strength for each node
  links.forEach(link => {
    const sourceTotal = nodeConnectionTotals.get(link.source) || 0;
    const targetTotal = nodeConnectionTotals.get(link.target) || 0;
    
    nodeConnectionTotals.set(link.source, sourceTotal + link.value);
    nodeConnectionTotals.set(link.target, targetTotal + link.value);
  });

  // Calculate percentages for each connection from both perspectives
  links.forEach(link => {
    const sourceTotal = nodeConnectionTotals.get(link.source) || 1;
    const targetTotal = nodeConnectionTotals.get(link.target) || 1;
    
    // Percentage from source perspective
    const sourcePercentage = Math.round((link.value / sourceTotal) * 100);
    percentageMap.set(`${link.source}-${link.target}`, sourcePercentage);
    
    // Percentage from target perspective  
    const targetPercentage = Math.round((link.value / targetTotal) * 100);
    percentageMap.set(`${link.target}-${link.source}`, targetPercentage);
  });

  console.log('[SoulNetWorker] Calculated', percentageMap.size, 'connection percentages');
  return percentageMap;
}

// Optimize node positions for better performance
function optimizeNodePositions(nodes: NodeData[]): NodeData[] {
  console.log('[SoulNetWorker] Optimizing positions for', nodes.length, 'nodes');
  
  return nodes.map(node => ({
    ...node,
    position: [
      Math.round(node.position[0] * 100) / 100, // Round to 2 decimal places
      Math.round(node.position[1] * 100) / 100,
      Math.round(node.position[2] * 100) / 100
    ] as [number, number, number]
  }));
}

// Handle messages from main thread
self.onmessage = function(e: MessageEvent<SoulNetWorkerMessage>) {
  const { type, payload } = e.data;
  
  try {
    switch (type) {
      case 'CALCULATE_PERCENTAGES': {
        const { nodes, links } = payload;
        const percentages = calculateAllConnectionPercentages(nodes, links);
        
        // Convert Map to Object for transfer
        const percentagesObj = Object.fromEntries(percentages);
        
        self.postMessage({
          type: 'PERCENTAGES_CALCULATED',
          payload: { percentages: percentagesObj }
        });
        break;
      }
      
      case 'OPTIMIZE_POSITIONS': {
        const { nodes } = payload;
        const optimizedNodes = optimizeNodePositions(nodes);
        
        self.postMessage({
          type: 'POSITIONS_OPTIMIZED',
          payload: { nodes: optimizedNodes }
        });
        break;
      }
      
      default:
        console.warn('[SoulNetWorker] Unknown message type:', type);
    }
  } catch (error) {
    console.error('[SoulNetWorker] Error processing message:', error);
    self.postMessage({
      type: 'ERROR',
      payload: { error: error.message }
    });
  }
};

console.log('[SoulNetWorker] Worker initialized and ready');
