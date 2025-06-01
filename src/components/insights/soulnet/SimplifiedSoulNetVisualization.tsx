
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import SimpleNode from './SimpleNode';
import Edge from './Edge';
import HtmlTextOverlay from './HtmlTextOverlay';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/contexts/TranslationContext';
import { onDemandTranslationCache } from '@/utils/website-translations';
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
  const { theme } = useTheme();
  const { currentLanguage, translate } = useTranslation();
  const controlsRef = useRef<any>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(45);
  const [isInitialized, setIsInitialized] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<Map<string, string>>(new Map());
  const initializationRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  
  console.log("[SimplifiedSoulNetVisualization] Enhanced render with robust initialization");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Enhanced data validation with comprehensive checks
  const validData = useMemo(() => {
    try {
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        console.warn('[SimplifiedSoulNetVisualization] Invalid data structure');
        return { nodes: [], links: [] };
      }
      
      const validNodes = data.nodes.filter(node => {
        if (!node || !node.id) return false;
        if (!Array.isArray(node.position) || node.position.length !== 3) return false;
        if (node.position.some(coord => isNaN(coord) || !isFinite(coord))) return false;
        return true;
      });
      
      const validLinks = data.links.filter(link => {
        if (!link || !link.source || !link.target) return false;
        // Ensure both source and target nodes exist
        const sourceExists = validNodes.some(node => node.id === link.source);
        const targetExists = validNodes.some(node => node.id === link.target);
        return sourceExists && targetExists;
      });
      
      console.log(`[SimplifiedSoulNetVisualization] Data validation: ${validNodes.length}/${data.nodes.length} nodes, ${validLinks.length}/${data.links.length} links valid`);
      
      return { nodes: validNodes, links: validLinks };
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Data validation error:', error);
      return { nodes: [], links: [] };
    }
  }, [data]);

  // Enhanced center position calculation with safety checks
  const centerPosition = useMemo(() => {
    try {
      if (validData.nodes.length === 0) return new THREE.Vector3(0, 0, 0);
      
      const positions = validData.nodes.map(node => node.position);
      const centerX = positions.reduce((sum, pos) => sum + (pos[0] || 0), 0) / positions.length;
      const centerY = positions.reduce((sum, pos) => sum + (pos[1] || 0), 0) / positions.length;
      
      // Ensure finite values
      const finalX = isFinite(centerX) ? centerX : 0;
      const finalY = isFinite(centerY) ? centerY : 0;
      
      return new THREE.Vector3(finalX, finalY, 0);
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Center calculation error:', error);
      return new THREE.Vector3(0, 0, 0);
    }
  }, [validData.nodes]);

  // Robust initialization with comprehensive error handling
  useEffect(() => {
    if (validData.nodes.length === 0 || initializationRef.current || !mountedRef.current) return;
    
    console.log('[SimplifiedSoulNetVisualization] Starting robust initialization');
    
    const initializeVisualization = async () => {
      try {
        initializationRef.current = true;

        if (camera && validData.nodes.length > 0) {
          const targetZ = isFullScreen ? 40 : 45;
          
          // Ensure camera position is valid
          const cameraX = isFinite(centerPosition.x) ? centerPosition.x : 0;
          const cameraY = isFinite(centerPosition.y) ? centerPosition.y : 0;
          const cameraZ = isFinite(targetZ) ? targetZ : 45;
          
          camera.position.set(cameraX, cameraY, cameraZ);
          camera.lookAt(cameraX, cameraY, 0);
          camera.updateProjectionMatrix();
          
          console.log('[SimplifiedSoulNetVisualization] Camera initialized at:', { x: cameraX, y: cameraY, z: cameraZ });
          
          // Delayed initialization completion
          setTimeout(() => {
            if (mountedRef.current) {
              setIsInitialized(true);
              console.log('[SimplifiedSoulNetVisualization] Robust initialization complete');
            }
          }, 100);
        }
      } catch (error) {
        console.error('[SimplifiedSoulNetVisualization] Initialization error:', error);
        initializationRef.current = false;
        
        // Fallback initialization
        setTimeout(() => {
          if (mountedRef.current) {
            setIsInitialized(true);
            console.log('[SimplifiedSoulNetVisualization] Fallback initialization complete');
          }
        }, 500);
      }
    };

    initializeVisualization();
  }, [camera, validData.nodes, centerPosition, isFullScreen]);

  // Enhanced translation handling with robust error recovery
  useEffect(() => {
    if (!isInitialized || currentLanguage === 'en' || validData.nodes.length === 0 || !mountedRef.current) return;

    const translateTexts = async () => {
      try {
        const newTranslations = new Map<string, string>();
        
        for (const node of validData.nodes) {
          if (!mountedRef.current) break;
          
          try {
            // Check cache first
            const cached = onDemandTranslationCache.getTranslation(node.id, currentLanguage);
            
            if (cached) {
              newTranslations.set(node.id, cached);
              console.log(`[SimplifiedSoulNetVisualization] Using cached translation for "${node.id}"`);
              continue;
            }

            if (translate) {
              try {
                const translated = await Promise.race([
                  translate(node.id),
                  new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('Translation timeout')), 3000)
                  )
                ]);
                
                if (mountedRef.current && translated && typeof translated === 'string') {
                  newTranslations.set(node.id, translated);
                  onDemandTranslationCache.setTranslation(node.id, translated, currentLanguage);
                  console.log(`[SimplifiedSoulNetVisualization] Translated "${node.id}" to "${translated}"`);
                }
              } catch (error) {
                console.warn(`[SimplifiedSoulNetVisualization] Translation failed for "${node.id}":`, error);
                newTranslations.set(node.id, node.id);
              }
            } else {
              newTranslations.set(node.id, node.id);
            }
          } catch (error) {
            console.error(`[SimplifiedSoulNetVisualization] Translation error for "${node.id}":`, error);
            newTranslations.set(node.id, node.id);
          }
        }
        
        if (mountedRef.current) {
          setTranslatedTexts(newTranslations);
          console.log('[SimplifiedSoulNetVisualization] Translation processing complete');
        }
      } catch (error) {
        console.error('[SimplifiedSoulNetVisualization] Translation batch error:', error);
      }
    };

    translateTexts();
  }, [validData.nodes, currentLanguage, translate, isInitialized]);

  // Enhanced camera zoom tracking with error prevention
  useFrame(() => {
    try {
      if (camera && isInitialized && mountedRef.current) {
        const currentZ = camera.position.z;
        if (isFinite(currentZ) && Math.abs(currentZ - cameraZoom) > 1) {
          setCameraZoom(currentZ);
        }
      }
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Camera tracking error:', error);
    }
  });

  // Enhanced highlighted nodes calculation with safety checks
  const highlightedNodes = useMemo(() => {
    try {
      if (!selectedNode || !validData.links || !isInitialized) return new Set<string>();
      
      const connected = new Set<string>();
      validData.links.forEach(link => {
        if (!link || !link.source || !link.target) return;
        if (link.source === selectedNode) connected.add(link.target);
        if (link.target === selectedNode) connected.add(link.source);
      });
      
      return connected;
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Highlighted nodes calculation error:', error);
      return new Set<string>();
    }
  }, [selectedNode, validData.links, isInitialized]);

  // Enhanced node click handler with error recovery
  const handleNodeClick = useCallback((id: string) => {
    try {
      if (typeof onNodeClick === 'function') {
        onNodeClick(id);
      }
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Node click error:', error);
    }
  }, [onNodeClick]);

  // Enhanced text overlay items with comprehensive safety checks
  const textOverlayItems = useMemo(() => {
    if (!isInitialized || !shouldShowLabels || !mountedRef.current) return [];

    try {
      return validData.nodes.map(node => {
        const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
        
        const getTextColor = () => {
          if (selectedNode === node.id) {
            return theme === 'light' ? '#000000' : '#ffffff';
          }
          
          if (isHighlighted) {
            return node.type === 'emotion' 
              ? (theme === 'light' ? '#2563eb' : '#60a5fa')
              : (theme === 'light' ? '#dc2626' : '#f87171');
          }
          
          return theme === 'light' ? '#666666' : '#999999';
        };

        const getLabelOffset = (): [number, number, number] => {
          const geometricOffset = node.type === 'entity' 
            ? 1.4 * 1.3
            : Math.sqrt(3) * (2.1 / 2) * 1.3;
          
          return [
            node.position[0], 
            node.position[1] + geometricOffset, 
            node.position[2]
          ];
        };

        const displayText = currentLanguage === 'en' 
          ? node.id 
          : (translatedTexts.get(node.id) || node.id);

        const baseSize = 0.35;
        const zoomFactor = Math.max(0, (45 - cameraZoom) * 0.007);
        const calculatedSize = baseSize + zoomFactor;
        const finalSize = isFinite(calculatedSize) ? calculatedSize : baseSize;

        return {
          id: node.id,
          text: displayText,
          position: getLabelOffset(),
          color: getTextColor(),
          size: finalSize,
          visible: true,
          bold: isHighlighted || selectedNode === node.id,
          isHighlighted,
          isSelected: selectedNode === node.id,
          nodeType: node.type
        };
      });
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Text overlay error:', error);
      return [];
    }
  }, [validData.nodes, isInitialized, shouldShowLabels, selectedNode, highlightedNodes, theme, cameraZoom, translatedTexts, currentLanguage]);

  // Enhanced loading state
  if (!isInitialized || validData.nodes.length === 0) {
    return (
      <>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.4} />
      </>
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

        {/* Enhanced edge rendering with comprehensive error handling */}
        {validData.links.map((link, index) => {
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

        {/* Enhanced node rendering with comprehensive error handling */}
        {validData.nodes.map(node => {
          try {
            const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
            const dimmed = !!selectedNode && !isHighlighted;

            return (
              <SimpleNode
                key={`node-${node.id}`}
                node={node}
                isSelected={selectedNode === node.id}
                onClick={handleNodeClick}
                highlightedNodes={highlightedNodes}
                dimmed={dimmed}
                themeHex={themeHex}
                isHighlighted={isHighlighted}
              />
            );
          } catch (error) {
            console.warn(`[SimplifiedSoulNetVisualization] Node render error for ${node.id}:`, error);
            return null;
          }
        })}

        {/* Enhanced HTML Text Overlay */}
        <HtmlTextOverlay textItems={textOverlayItems} />
      </>
    );
  } catch (error) {
    console.error('[SimplifiedSoulNetVisualization] Main render error:', error);
    return (
      <>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.4} />
      </>
    );
  }
};

export default SimplifiedSoulNetVisualization;
