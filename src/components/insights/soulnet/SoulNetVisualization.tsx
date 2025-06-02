import React, { useRef, useEffect, useMemo, useState } from 'react';
import '@/types/three-reference';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';
import Node from './Node';
import Edge from './Edge';
import * as THREE from 'three';

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

interface SoulNetVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  shouldShowLabels?: boolean;
}

// Enhanced script detection utilities
const containsNonLatinScript = (text: string): boolean => {
  if (!text) return false;
  
  const patterns = {
    devanagari: /[\u0900-\u097F]/,
    arabic: /[\u0600-\u06FF]/,
    chinese: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/,
    cyrillic: /[\u0400-\u04FF]/,
    thai: /[\u0E00-\u0E7F]/,
    bengali: /[\u0980-\u09FF]/,
    gujarati: /[\u0A80-\u0AFF]/,
    gurmukhi: /[\u0A00-\u0A7F]/,
    kannada: /[\u0C80-\u0CFF]/,
    malayalam: /[\u0D00-\u0D7F]/,
    oriya: /[\u0B00-\u0B7F]/,
    tamil: /[\u0B80-\u0BFF]/,
    telugu: /[\u0C00-\u0C7F]/
  };
  
  return Object.values(patterns).some(pattern => pattern.test(text));
};

const detectScriptType = (text: string): string => {
  if (!text) return 'latin';
  
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'chinese';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'thai';
  
  return 'latin';
};

function getConnectedNodes(nodeId: string, links: LinkData[]): Set<string> {
  if (!nodeId || !links || !Array.isArray(links)) return new Set<string>();
  
  const connected = new Set<string>();
  links.forEach(link => {
    if (!link || typeof link !== 'object') return;
    
    if (link.source === nodeId) connected.add(link.target);
    if (link.target === nodeId) connected.add(link.source);
  });
  return connected;
}

// Calculate relative connection strength within connected nodes
function calculateRelativeStrengths(nodeId: string, links: LinkData[]): Map<string, number> {
  if (!nodeId || !links || !Array.isArray(links)) return new Map<string, number>();
  
  const nodeLinks = links.filter(link => 
    link && typeof link === 'object' && (link.source === nodeId || link.target === nodeId)
  );
  
  let minValue = Infinity;
  let maxValue = -Infinity;
  
  nodeLinks.forEach(link => {
    if (link.value < minValue) minValue = link.value;
    if (link.value > maxValue) maxValue = link.value;
  });

  const strengthMap = new Map<string, number>();
  
  if (maxValue === minValue || maxValue - minValue < 0.001) {
    nodeLinks.forEach(link => {
      const connectedNodeId = link.source === nodeId ? link.target : link.source;
      strengthMap.set(connectedNodeId, 0.8);
    });
  } else {
    nodeLinks.forEach(link => {
      const connectedNodeId = link.source === nodeId ? link.target : link.source;
      const normalizedValue = 0.3 + (0.7 * (link.value - minValue) / (maxValue - minValue));
      strengthMap.set(connectedNodeId, normalizedValue);
    });
  }
  
  console.log(`[SoulNetVisualization] Connection strengths for ${nodeId}:`, Object.fromEntries(strengthMap));
  return strengthMap;
}

// Enhanced percentage calculation with better logging
function calculateConnectionPercentages(nodeId: string, links: LinkData[]): Map<string, number> {
  if (!nodeId || !links || !Array.isArray(links)) return new Map<string, number>();
  
  const nodeLinks = links.filter(link => 
    link && typeof link === 'object' && (link.source === nodeId || link.target === nodeId)
  );
  
  const totalValue = nodeLinks.reduce((sum, link) => sum + link.value, 0);
  
  if (totalValue === 0) {
    console.log(`[SoulNetVisualization] No total value for ${nodeId}`);
    return new Map<string, number>();
  }
  
  const percentageMap = new Map<string, number>();
  
  nodeLinks.forEach(link => {
    const connectedNodeId = link.source === nodeId ? link.target : link.source;
    const percentage = Math.round((link.value / totalValue) * 100);
    percentageMap.set(connectedNodeId, percentage);
  });
  
  console.log(`[SoulNetVisualization] Connection percentages for ${nodeId}:`, Object.fromEntries(percentageMap));
  return percentageMap;
}

export const SoulNetVisualization: React.FC<SoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true
}) => {
  const { camera, size } = useThree();
  const { currentLanguage, translate } = useTranslation();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(45);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());
  const [nodeScriptTypes, setNodeScriptTypes] = useState<Map<string, string>>(new Map());
  const [debugInfo, setDebugInfo] = useState<string>('');
  const mounted = useRef<boolean>(true);
  const translationInProgressRef = useRef<boolean>(false);
  
  console.log("[SoulNetVisualization] DEBUGGING - Initial state", {
    nodeCount: data?.nodes?.length,
    linkCount: data?.links?.length,
    currentLanguage,
    selectedNode,
    shouldShowLabels,
    translationCacheSize: translationCache.size,
    translateFunction: !!translate
  });
  
  useEffect(() => {
    console.log("[SoulNetVisualization] Component mounted with enhanced debugging");
    return () => {
      console.log("[SoulNetVisualization] Component unmounted");
      mounted.current = false;
    };
  }, []);

  // Ensure data is valid
  const validData = useMemo(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes) || !data.links || !Array.isArray(data.links)) {
      console.error("[SoulNetVisualization] Invalid data:", data);
      return {
        nodes: [],
        links: []
      };
    }
    return data;
  }, [data]);
  
  // Enhanced node label translation with improved debugging and reliability
  useEffect(() => {
    if (!data?.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0 || !mounted.current) {
      console.log("[SoulNetVisualization] Skipping translation - invalid nodes or unmounted component");
      return;
    }

    console.log(`[SoulNetVisualization] Translation effect triggered. Language: ${currentLanguage}, Nodes: ${data.nodes.length}`);

    // Skip if a translation is already in progress
    if (translationInProgressRef.current) {
      console.log("[SoulNetVisualization] Translation already in progress, skipping");
      return;
    }

    translationInProgressRef.current = true;

    const processNodeLabels = async () => {
      console.log('[SoulNetVisualization] Starting node label translation process', {
        currentLanguage,
        nodeCount: data.nodes.length,
        translateAvailable: !!translate,
      });
      
      const newTranslationCache = new Map<string, string>(translationCache);
      const newScriptTypes = new Map<string, string>();
      let debugMessages: string[] = [];
      
      // Process script types for all nodes
      data.nodes.forEach(node => {
        const scriptType = detectScriptType(node.id);
        newScriptTypes.set(node.id, scriptType);
      });
      
      if (mounted.current) {
        setNodeScriptTypes(newScriptTypes);
      }
      
      // Only translate if not English and translate function available
      if (currentLanguage !== 'en' && translate && mounted.current) {
        debugMessages.push(`Starting translation batch to ${currentLanguage}`);
        
        try {
          // Collect all node IDs that need translation
          const textsToTranslate = data.nodes
            .filter(node => !newTranslationCache.has(node.id))
            .map(node => node.id);
            
          console.log(`[SoulNetVisualization] Need to translate ${textsToTranslate.length} node labels`);
          
          if (textsToTranslate.length > 0) {
            // Process in smaller batches to avoid timeouts
            const batchSize = 5;
            for (let i = 0; i < textsToTranslate.length; i += batchSize) {
              if (!mounted.current) break;
              
              const batch = textsToTranslate.slice(i, i + batchSize);
              console.log(`[SoulNetVisualization] Processing batch ${i/batchSize + 1}: ${batch.join(', ')}`);
              
              // Process each item in the batch
              await Promise.all(batch.map(async (text) => {
                try {
                  // Force translation from English source
                  const translatedText = await translate(text, 'en');
                  
                  if (translatedText && translatedText !== text) {
                    console.log(`[SoulNetVisualization] Translation success: "${text}" -> "${translatedText}"`);
                    newTranslationCache.set(text, translatedText);
                    
                    // Also save to global cache
                    onDemandTranslationCache.set(currentLanguage, text, translatedText);
                  } else {
                    console.log(`[SoulNetVisualization] Translation returned same text for "${text}"`);
                    newTranslationCache.set(text, text);
                  }
                } catch (error) {
                  console.error(`[SoulNetVisualization] Error translating "${text}":`, error);
                  newTranslationCache.set(text, text);
                }
              }));
              
              // Brief pause between batches
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (error) {
          console.error('[SoulNetVisualization] Batch translation error:', error);
          debugMessages.push(`Translation error: ${error.message}`);
        }
      } else {
        // For English, use original labels
        data.nodes.forEach(node => {
          newTranslationCache.set(node.id, node.id);
        });
      }
      
      if (mounted.current) {
        console.log('[SoulNetVisualization] Setting translation cache with:', 
          Array.from(newTranslationCache.entries()).slice(0, 5));
        setTranslationCache(newTranslationCache);
        setDebugInfo(debugMessages.join(' | '));
        
        // Force re-render after translation
        setForceUpdate(prev => prev + 1);
      }
      
      translationInProgressRef.current = false;
    };

    processNodeLabels();
    
    return () => {
      // Ensure we flag that any in-progress translation should stop
      translationInProgressRef.current = false;
    };
  }, [data?.nodes, currentLanguage, translate]);
  
  // Use memoization to prevent recalculation of center position on every render
  const centerPosition = useMemo(() => {
    if (!validData.nodes || validData.nodes.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    try {
      const validNodes = validData.nodes.filter(node => 
        node && node.position && Array.isArray(node.position) && node.position.length === 3
      );
      
      if (validNodes.length === 0) {
        return new THREE.Vector3(0, 0, 0);
      }
      
      const nodePositions = validNodes.map(node => node.position);
      const centerX = nodePositions.reduce((sum, pos) => sum + pos[0], 0) / Math.max(nodePositions.length, 1);
      const centerY = nodePositions.reduce((sum, pos) => sum + pos[1], 0) / Math.max(nodePositions.length, 1);
      const centerZ = 0;
      return new THREE.Vector3(centerX, centerY, centerZ);
    } catch (error) {
      console.error("Error calculating center position:", error);
      return new THREE.Vector3(0, 0, 0);
    }
  }, [validData.nodes]);

  useEffect(() => {
    if (selectedNode) {
      console.log(`[SoulNetVisualization] Selected node: ${selectedNode}`);
      setForceUpdate(prev => prev + 1);
      const timer = setTimeout(() => {
        setForceUpdate(prev => prev + 1);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedNode]);

  // Optimized camera initialization
  useEffect(() => {
    if (camera && validData.nodes?.length > 0 && !isInitialized) {
      console.log("[SoulNetVisualization] Initializing camera position");
      try {
        const centerX = centerPosition.x;
        const centerY = centerPosition.y;
        camera.position.set(centerX, centerY, 45);
        camera.lookAt(centerX, centerY, 0);
        setIsInitialized(true);
      } catch (error) {
        console.error("Error setting camera position:", error);
      }
    }
  }, [camera, validData.nodes, centerPosition, isInitialized]);

  // Track camera zoom with throttling
  useEffect(() => {
    const updateCameraDistance = () => {
      if (camera) {
        const currentZ = camera.position.z;
        if (Math.abs(currentZ - cameraZoom) > 0.5) {
          setCameraZoom(currentZ);
        }
      }
    };

    const intervalId = setInterval(updateCameraDistance, 200);
    return () => clearInterval(intervalId);
  }, [camera, cameraZoom]);

  // Memoize connected nodes
  const highlightedNodes = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Set<string>();
    return getConnectedNodes(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Calculate relative strength of connections
  const connectionStrengths = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Map<string, number>();
    return calculateRelativeStrengths(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Calculate percentage distribution of connections
  const connectionPercentages = useMemo(() => {
    if (!selectedNode || !validData || !validData.links) return new Map<string, number>();
    return calculateConnectionPercentages(selectedNode, validData.links);
  }, [selectedNode, validData?.links]);

  // Create a map for quick node lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    validData.nodes.forEach(node => {
      const baseScale = node.type === 'entity' ? 0.7 : 0.55;
      const isNodeHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
      const connectionStrength = selectedNode && highlightedNodes.has(node.id) 
        ? connectionStrengths.get(node.id) || 0.5
        : 0.5;
      
      const scale = isNodeHighlighted 
        ? baseScale * (1.2 + (selectedNode === node.id ? 0.3 : connectionStrength * 0.5))
        : baseScale * (0.8 + node.value * 0.5);
      
      map.set(node.id, { 
        ...node, 
        scale,
        isHighlighted: isNodeHighlighted
      });
    });
    return map;
  }, [validData.nodes, selectedNode, highlightedNodes, connectionStrengths]);

  // Adjust controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.dampingFactor = isFullScreen ? 0.08 : 0.05;
      controlsRef.current.minDistance = isFullScreen ? 8 : 10;
      controlsRef.current.maxDistance = isFullScreen ? 80 : 60;
    }
  }, [isFullScreen]);

  const shouldDim = !!selectedNode;

  // Custom node click handler
  const handleNodeClick = (id: string, e: any) => {
    console.log(`[SoulNetVisualization] Node clicked: ${id}`);
    onNodeClick(id);
  };

  if (!validData || !validData.nodes || !validData.links) {
    console.error("[SoulNetVisualization] Data is missing or invalid", validData);
    return null;
  }

  console.log("[SoulNetVisualization] FINAL RENDER CHECK", { 
    translationCacheSize: translationCache.size,
    currentLanguage,
    shouldTranslate: currentLanguage !== 'en',
    nodeCount: validData.nodes.length,
    translatedNodes: Array.from(translationCache.entries()).slice(0, 3)
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      {isFullScreen && (
        <>
          <hemisphereLight intensity={0.3} color="#ffffff" groundColor="#444444" />
          <pointLight position={[-10, -10, -10]} intensity={0.2} />
        </>
      )}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={isFullScreen ? 0.08 : 0.05}
        rotateSpeed={0.5}
        minDistance={isFullScreen ? 8 : 10}
        maxDistance={isFullScreen ? 80 : 60}
        target={centerPosition}
        onChange={() => {
          if (camera) {
            const currentZ = camera.position.z;
            if (Math.abs(currentZ - cameraZoom) > 0.5) {
              setCameraZoom(currentZ);
            }
          }
        }}
      />
      
      {/* Display edges */}
      {validData.links.map((link, index) => {
        if (!link || typeof link !== 'object') {
          console.warn(`[SoulNetVisualization] Invalid link at index ${index}`, link);
          return null;
        }
        
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        
        if (!sourceNode || !targetNode) {
          console.warn(`[SoulNetVisualization] Missing source or target node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        const isHighlight = selectedNode &&
          (link.source === selectedNode || link.target === selectedNode);
          
        let relativeStrength = 0.3;
        
        if (isHighlight && selectedNode) {
          const connectedNodeId = link.source === selectedNode ? link.target : link.source;
          relativeStrength = connectionStrengths.get(connectedNodeId) || 0.7;
        } else {
          relativeStrength = link.value * 0.5;
        }
        
        if (!Array.isArray(sourceNode.position) || !Array.isArray(targetNode.position)) {
          return null;
        }
          
        return (
          <Edge
            key={`edge-${index}-${forceUpdate}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={relativeStrength}
            isHighlighted={!!isHighlight}
            dimmed={shouldDim && !isHighlight}
            maxThickness={isHighlight ? 10 : 4}
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
            startNodeScale={sourceNode.scale}
            endNodeScale={targetNode.scale}
          />
        );
      })}
      
      {/* Display nodes with translation */}
      {validData.nodes.map(node => {
        if (!node || typeof node !== 'object' || !node.id) {
          console.warn("[SoulNetVisualization] Invalid node:", node);
          return null;
        }
        
        // Stable label visibility logic
        const showLabel = shouldShowLabels;
        const dimmed = shouldDim && !(selectedNode === node.id || highlightedNodes.has(node.id));
        const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
        
        const connectionPercentage = selectedNode && highlightedNodes.has(node.id)
          ? connectionPercentages.get(node.id) || 0
          : 0;
          
        // Enhanced percentage visibility: show for all highlighted nodes (including connected nodes)
        const showPercentage = selectedNode !== null && 
                              isHighlighted && 
                              connectionPercentage > 0 &&
                              node.id !== selectedNode; // Only exclude the selected node itself
        
        if (!Array.isArray(node.position)) {
          console.warn(`[SoulNetVisualization] Node ${node.id} has invalid position:`, node.position);
          return null;
        }

        // Get translated text with fallback to original text
        const translatedLabel = translationCache.get(node.id) || node.id;
        
        return (
          <Node
            key={`node-${node.id}-${translatedLabel}-${forceUpdate}`}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={handleNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={showLabel}
            dimmed={dimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={cameraZoom}
            isHighlighted={isHighlighted}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
            forceShowLabels={shouldShowLabels}
            translatedText={translatedLabel}
          />
        );
      })}
    </>
  );
};

export default SoulNetVisualization;
