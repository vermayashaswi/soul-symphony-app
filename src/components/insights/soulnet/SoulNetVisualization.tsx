
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
  const mounted = useRef<boolean>(true);
  
  console.log("[SoulNetVisualization] Rendering with enhanced percentage visibility", {
    nodeCount: data?.nodes?.length,
    linkCount: data?.links?.length,
    currentLanguage,
    selectedNode,
    shouldShowLabels
  });
  
  useEffect(() => {
    console.log("[SoulNetVisualization] Component mounted with enhanced stability");
    return () => {
      console.log("[SoulNetVisualization] Component unmounted");
      mounted.current = false;
    };
  }, []);

  // Enhanced node data processing with script detection and stable caching
  useEffect(() => {
    if (!data?.nodes || !mounted.current) return;

    const processNodeLabels = async () => {
      console.log('[SoulNetVisualization] Processing node labels with enhanced stability');
      
      const newTranslationCache = new Map<string, string>();
      const newScriptTypes = new Map<string, string>();
      
      // Process script types for all nodes
      data.nodes.forEach(node => {
        const scriptType = detectScriptType(node.id);
        newScriptTypes.set(node.id, scriptType);
        console.log(`[SoulNetVisualization] Node "${node.id}" detected script: ${scriptType}`);
      });
      
      if (mounted.current) {
        setNodeScriptTypes(newScriptTypes);
      }
      
      // Handle translations with enhanced stability
      if (currentLanguage !== 'en' && mounted.current) {
        for (const node of data.nodes) {
          if (!mounted.current) break;
          
          try {
            // Check cache first - use correct method name
            const cachedTranslation = onDemandTranslationCache.get(currentLanguage, node.id);
            
            if (cachedTranslation) {
              newTranslationCache.set(node.id, cachedTranslation);
              console.log(`[SoulNetVisualization] Using cached translation for "${node.id}": "${cachedTranslation}"`);
            } else if (translate) {
              // Translate with timeout and error handling
              try {
                const translated = await Promise.race([
                  translate(node.id),
                  new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('Translation timeout')), 5000)
                  )
                ]);
                
                if (mounted.current && translated && typeof translated === 'string') {
                  newTranslationCache.set(node.id, translated);
                  onDemandTranslationCache.set(currentLanguage, node.id, translated);
                  console.log(`[SoulNetVisualization] Translated "${node.id}" to "${translated}"`);
                }
              } catch (error) {
                console.warn(`[SoulNetVisualization] Translation failed for "${node.id}":`, error);
                newTranslationCache.set(node.id, node.id);
              }
            } else {
              newTranslationCache.set(node.id, node.id);
            }
          } catch (error) {
            console.error(`[SoulNetVisualization] Translation error for "${node.id}":`, error);
            newTranslationCache.set(node.id, node.id);
          }
        }
      } else {
        // For English, use original labels
        data.nodes.forEach(node => {
          newTranslationCache.set(node.id, node.id);
        });
      }
      
      if (mounted.current) {
        setTranslationCache(newTranslationCache);
        console.log('[SoulNetVisualization] Node label processing complete');
      }
    };

    processNodeLabels();
  }, [data?.nodes, currentLanguage, translate]);
  
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
      
      {/* Display nodes with enhanced percentage visibility */}
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

        const scriptType = nodeScriptTypes.get(node.id) || 'latin';
        const translatedLabel = translationCache.get(node.id) || node.id;
        
        console.log(`[SoulNetVisualization] Rendering node "${node.id}" - highlighted: ${isHighlighted}, showPercentage: ${showPercentage}, percentage: ${connectionPercentage}%`);
          
        return (
          <Node
            key={`node-${node.id}-${forceUpdate}`}
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
          />
        );
      })}
    </>
  );
};

export default SoulNetVisualization;
