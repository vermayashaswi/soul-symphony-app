
// Web Worker for SoulNet intensive calculations
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

interface WorkerMessage {
  type: string;
  payload: any;
}

// Handle messages from main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'CALCULATE_PERCENTAGES':
      try {
        const { nodes, links } = payload as { nodes: NodeData[], links: LinkData[] };
        const percentages = calculateConnectionPercentages(nodes, links);
        
        self.postMessage({
          type: 'PERCENTAGES_CALCULATED',
          payload: { percentages: Object.fromEntries(percentages) }
        });
      } catch (error) {
        console.error('[SoulNetWorker] Error calculating percentages:', error);
        self.postMessage({
          type: 'ERROR',
          payload: { error: error.message }
        });
      }
      break;

    default:
      console.warn('[SoulNetWorker] Unknown message type:', type);
  }
});

function calculateConnectionPercentages(
  nodes: NodeData[],
  links: LinkData[]
): Map<string, number> {
  console.log('[SoulNetWorker] Calculating connection percentages for', nodes.length, 'nodes and', links.length, 'links');
  
  const percentageMap = new Map<string, number>();
  const nodeConnectionTotals = new Map<string, number>();
  
  // Calculate total connection strength for each node
  links.forEach(link => {
    const sourceTotal = nodeConnectionTotals.get(link.source) || 0;
    const targetTotal = nodeConnectionTotals.get(link.target) || 0;
    
    nodeConnectionTotals.set(link.source, sourceTotal + link.value);
    nodeConnectionTotals.set(link.target, targetTotal + link.value);
  });

  // Calculate percentages for each connection
  links.forEach(link => {
    const sourceTotal = nodeConnectionTotals.get(link.source) || 1;
    const targetTotal = nodeConnectionTotals.get(link.target) || 1;
    
    // Calculate percentage from source perspective
    const sourcePercentage = Math.round((link.value / sourceTotal) * 100);
    percentageMap.set(`${link.source}-${link.target}`, sourcePercentage);
    
    // Calculate percentage from target perspective
    const targetPercentage = Math.round((link.value / targetTotal) * 100);
    percentageMap.set(`${link.target}-${link.source}`, targetPercentage);
  });

  console.log('[SoulNetWorker] Calculated', percentageMap.size, 'connection percentages');
  return percentageMap;
}

// Export for TypeScript compatibility
export {};
