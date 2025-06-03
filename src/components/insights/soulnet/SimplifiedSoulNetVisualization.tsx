
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useTranslation } from '@/contexts/TranslationContext';
import { useTheme } from '@/hooks/use-theme';
import Node from './Node';
import Edge from './Edge';
import FallbackVisualization from './FallbackVisualization';
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

interface SimplifiedSoulNetVisualizationProps {
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen?: boolean;
  shouldShowLabels?: boolean;
}

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen = false,
  shouldShowLabels = true
}) => {
  const { camera } = useThree();
  const { currentLanguage, translate } = useTranslation();
  const { theme, systemTheme } = useTheme();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(45);
  const [renderingStage, setRenderingStage] = useState<'initial' | 'basic' | 'enhanced'>('initial');
  const [isInitialized, setIsInitialized] = useState(false);
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());
  const initializationRef = useRef<boolean>(false);
  const mounted = useRef<boolean>(true);
  
  console.log("[SimplifiedSoulNetVisualization] GOOGLE TRANSLATE ONLY - Rendering stage:", renderingStage);

  // Get current effective theme for font color calculation
  const effectiveTheme = useMemo(() => {
    if (theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  useEffect(() => {
    console.log("[SimplifiedSoulNetVisualization] Component mounted - Google Translate only mode");
    return () => {
      mounted.current = false;
    };
  }, []);

  // Validate data with safer approach
  const validData = useMemo(() => {
    try {
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        console.warn('[SimplifiedSoulNetVisualization] Invalid data structure');
        return { nodes: [], links: [] };
      }
      return {
        nodes: data.nodes.filter(node => node && node.id && Array.isArray(node.position) && node.position.length === 3),
        links: data.links.filter(link => link && link.source && link.target)
      };
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Data validation error:', error);
      return { nodes: [], links: [] };
    }
  }, [data]);

  // Calculate center position safely
  const centerPosition = useMemo(() => {
    try {
      if (validData.nodes.length === 0) return new THREE.Vector3(0, 0, 0);
      
      const positions = validData.nodes.map(node => node.position);
      const centerX = positions.reduce((sum, pos) => sum + (pos[0] || 0), 0) / positions.length;
      const centerY = positions.reduce((sum, pos) => sum + (pos[1] || 0), 0) / positions.length;
      
      return new THREE.Vector3(centerX, centerY, 0);
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Center calculation error:', error);
      return new THREE.Vector3(0, 0, 0);
    }
  }, [validData.nodes]);

  // FIXED: Enhanced connection percentages calculation with proper normalization
  const connectionPercentages = useMemo(() => {
    if (!selectedNode || !validData.links) {
      console.log('[SimplifiedSoulNetVisualization] No selected node or links, clearing percentages');
      return new Map<string, number>();
    }
    
    const percentages = new Map<string, number>();
    const selectedConnections = validData.links.filter(
      link => link.source === selectedNode || link.target === selectedNode
    );
    
    if (selectedConnections.length === 0) {
      console.log('[SimplifiedSoulNetVisualization] No connections found for selected node:', selectedNode);
      return percentages;
    }
    
    console.log(`[SimplifiedSoulNetVisualization] Found ${selectedConnections.length} connections for node:`, selectedNode);
    
    // ENHANCED: Better normalization - use max connection strength as 100%
    const connectionStrengths = selectedConnections.map(link => link.value || 1);
    const maxStrength = Math.max(...connectionStrengths);
    const totalStrength = connectionStrengths.reduce((sum, strength) => sum + strength, 0);
    
    selectedConnections.forEach(link => {
      const connectedNodeId = link.source === selectedNode ? link.target : link.source;
      const connectionStrength = link.value || 1;
      
      // Use percentage relative to strongest connection for better visibility
      const percentageByMax = Math.round((connectionStrength / maxStrength) * 100);
      // Also calculate relative to total for comparison
      const percentageByTotal = Math.round((connectionStrength / totalStrength) * 100);
      
      // Use the higher of the two for better visibility, minimum 5%
      const finalPercentage = Math.max(5, Math.max(percentageByMax, percentageByTotal));
      
      percentages.set(connectedNodeId, Math.min(100, finalPercentage));
      
      console.log(`[SimplifiedSoulNetVisualization] Connection ${selectedNode} -> ${connectedNodeId}: strength=${connectionStrength}, percentage=${finalPercentage}%`);
    });
    
    console.log('[SimplifiedSoulNetVisualization] Final connection percentages:', Object.fromEntries(percentages));
    return percentages;
  }, [selectedNode, validData.links]);

  // Google Translate only translation processing
  useEffect(() => {
    if (!data?.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0 || !mounted.current) {
      return;
    }

    const processTranslations = async () => {
      if (currentLanguage !== 'en' && translate) {
        console.log('[SimplifiedSoulNetVisualization] Processing Google Translate translations');
        const newCache = new Map<string, string>();
        
        for (const node of data.nodes) {
          if (!newCache.has(node.id)) {
            try {
              const translated = await translate(node.id, 'en');
              newCache.set(node.id, translated || node.id);
            } catch (error) {
              console.error(`[SimplifiedSoulNetVisualization] Translation error for ${node.id}:`, error);
              newCache.set(node.id, node.id);
            }
          }
        }
        
        if (mounted.current) {
          setTranslationCache(newCache);
        }
      } else {
        // For English, use original labels
        const englishCache = new Map<string, string>();
        data.nodes.forEach(node => {
          englishCache.set(node.id, node.id);
        });
        setTranslationCache(englishCache);
      }
    };

    processTranslations();
  }, [data?.nodes, currentLanguage, translate]);

  // Staged initialization with proper timing
  useEffect(() => {
    if (validData.nodes.length === 0 || initializationRef.current) return;
    
    console.log('[SimplifiedSoulNetVisualization] Starting staged initialization');
    initializationRef.current = true;

    // Stage 1: Initial render (immediate)
    setRenderingStage('initial');

    // Stage 2: Basic render with delay
    const basicTimer = setTimeout(() => {
      try {
        if (camera && validData.nodes.length > 0) {
          camera.position.set(centerPosition.x, centerPosition.y, 45);
          camera.lookAt(centerPosition.x, centerPosition.y, 0);
          setIsInitialized(true);
          setRenderingStage('basic');
          console.log('[SimplifiedSoulNetVisualization] Camera initialized, moving to basic stage');
        }
      } catch (error) {
        console.error('[SimplifiedSoulNetVisualization] Basic stage error:', error);
        setRenderingStage('initial');
      }
    }, 100);

    // Stage 3: Enhanced render with longer delay
    const enhancedTimer = setTimeout(() => {
      try {
        setRenderingStage('enhanced');
        console.log('[SimplifiedSoulNetVisualization] Moving to enhanced stage');
      } catch (error) {
        console.error('[SimplifiedSoulNetVisualization] Enhanced stage error:', error);
        // Stay in basic stage on error
      }
    }, 500);

    return () => {
      clearTimeout(basicTimer);
      clearTimeout(enhancedTimer);
    };
  }, [camera, validData.nodes, centerPosition]);

  // Safe camera zoom tracking with useFrame
  useFrame(() => {
    try {
      if (camera && renderingStage !== 'initial') {
        const currentZ = camera.position.z;
        if (Math.abs(currentZ - cameraZoom) > 1) {
          setCameraZoom(currentZ);
        }
      }
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Camera tracking error:', error);
    }
  });

  // Calculate highlighted nodes with safety checks
  const highlightedNodes = useMemo(() => {
    try {
      if (!selectedNode || !validData.links || renderingStage === 'initial') return new Set<string>();
      
      const connected = new Set<string>();
      validData.links.forEach(link => {
        if (link.source === selectedNode) connected.add(link.target);
        if (link.target === selectedNode) connected.add(link.source);
      });
      
      console.log(`[SimplifiedSoulNetVisualization] Highlighted nodes for ${selectedNode}:`, Array.from(connected));
      return connected;
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Highlighted nodes calculation error:', error);
      return new Set<string>();
    }
  }, [selectedNode, validData.links, renderingStage]);

  // Render nothing during initial stage
  if (renderingStage === 'initial' || validData.nodes.length === 0) {
    return (
      <>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.4} />
      </>
    );
  }

  // Fallback for persistent errors
  if (renderingStage === 'basic' && !isInitialized) {
    console.log('[SimplifiedSoulNetVisualization] Using fallback visualization');
    return (
      <FallbackVisualization
        data={validData}
        selectedNode={selectedNode}
        onNodeClick={onNodeClick}
        themeHex={themeHex}
      />
    );
  }

  try {
    return (
      <>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={isFullScreen ? 8 : 10}
          maxDistance={isFullScreen ? 80 : 60}
          target={centerPosition}
        />

        {/* Render edges only in enhanced stage */}
        {renderingStage === 'enhanced' && validData.links.map((link, index) => {
          try {
            const sourceNode = validData.nodes.find(n => n.id === link.source);
            const targetNode = validData.nodes.find(n => n.id === link.target);
            
            if (!sourceNode || !targetNode) return null;

            const isHighlight = selectedNode && 
              (link.source === selectedNode || link.target === selectedNode);

            return (
              <Edge
                key={`edge-${index}`}
                start={sourceNode.position}
                end={targetNode.position}
                value={link.value}
                isHighlighted={!!isHighlight}
                dimmed={!!selectedNode && !isHighlight}
                maxThickness={4}
                startNodeType={sourceNode.type}
                endNodeType={targetNode.type}
                startNodeScale={1}
                endNodeScale={1}
              />
            );
          } catch (error) {
            console.warn(`[SimplifiedSoulNetVisualization] Edge render error for index ${index}:`, error);
            return null;
          }
        })}

        {/* FIXED: Enhanced node rendering with corrected percentage logic */}
        {validData.nodes.map(node => {
          try {
            const isSelected = selectedNode === node.id;
            const isHighlighted = isSelected || highlightedNodes.has(node.id);
            const dimmed = !!selectedNode && !isHighlighted;
            
            // ENHANCED: More comprehensive label visibility logic
            const shouldShowNodeLabel = renderingStage === 'enhanced' && shouldShowLabels && (
              !selectedNode || // Show all labels when no node is selected
              isSelected || // Always show selected node label
              highlightedNodes.has(node.id) // Show connected node labels
            );
            
            // Get Google Translate translation
            const translatedText = translationCache.get(node.id) || node.id;
            
            // FIXED: Corrected percentage logic - show for connected nodes (not the selected node itself)
            const connectionPercentage = connectionPercentages.get(node.id) || 0;
            const showPercentage = !!selectedNode && isHighlighted && connectionPercentage > 0 && selectedNode !== node.id;

            // Enhanced debugging for percentage display
            if (selectedNode && node.type === 'emotion') {
              console.log(`[SimplifiedSoulNetVisualization] PERCENTAGE DEBUG for ${node.id}:`, {
                selectedNode,
                isHighlighted,
                connectionPercentage,
                showPercentage,
                isSelected,
                condition: `selectedNode=${!!selectedNode} && isHighlighted=${isHighlighted} && connectionPercentage=${connectionPercentage} > 0 && selectedNode !== node.id=${selectedNode !== node.id}`
              });
            }

            return (
              <Node
                key={`node-${node.id}`}
                node={node}
                isSelected={isSelected}
                onClick={(id, e) => {
                  try {
                    onNodeClick(id);
                  } catch (error) {
                    console.error('[SimplifiedSoulNetVisualization] Node click error:', error);
                  }
                }}
                highlightedNodes={highlightedNodes}
                showLabel={shouldShowNodeLabel}
                dimmed={dimmed}
                themeHex={themeHex}
                selectedNodeId={selectedNode}
                cameraZoom={cameraZoom}
                isHighlighted={isHighlighted}
                connectionPercentage={connectionPercentage}
                showPercentage={showPercentage}
                forceShowLabels={shouldShowNodeLabel}
                translatedText={translatedText}
                effectiveTheme={effectiveTheme}
              />
            );
          } catch (error) {
            console.warn(`[SimplifiedSoulNetVisualization] Node render error for ${node.id}:`, error);
            return null;
          }
        })}
      </>
    );
  } catch (error) {
    console.error('[SimplifiedSoulNetVisualization] Main render error:', error);
    return (
      <FallbackVisualization
        data={validData}
        selectedNode={selectedNode}
        onNodeClick={onNodeClick}
        themeHex={themeHex}
      />
    );
  }
};

export default SimplifiedSoulNetVisualization;
