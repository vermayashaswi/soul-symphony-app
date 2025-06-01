
import React, { useRef, useEffect, useMemo, useState } from 'react';
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
  const [renderingStage, setRenderingStage] = useState<'initial' | 'basic' | 'enhanced'>('initial');
  const [isInitialized, setIsInitialized] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<Map<string, string>>(new Map());
  const initializationRef = useRef<boolean>(false);
  
  console.log("[SimplifiedSoulNetVisualization] Rendering stage:", renderingStage);

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

  // Handle text translations
  useEffect(() => {
    if (renderingStage !== 'enhanced' || currentLanguage === 'en') return;

    const translateTexts = async () => {
      const newTranslations = new Map<string, string>();
      
      for (const node of validData.nodes) {
        try {
          // Check cache first
          const cached = onDemandTranslationCache.getTranslation(node.id, currentLanguage);
          if (cached) {
            newTranslations.set(node.id, cached);
            continue;
          }

          // Translate if not cached
          if (translate) {
            const translated = await translate(node.id);
            newTranslations.set(node.id, translated);
            onDemandTranslationCache.setTranslation(node.id, translated, currentLanguage);
          } else {
            newTranslations.set(node.id, node.id);
          }
        } catch (error) {
          console.error(`Translation error for ${node.id}:`, error);
          newTranslations.set(node.id, node.id);
        }
      }
      
      setTranslatedTexts(newTranslations);
    };

    translateTexts();
  }, [validData.nodes, currentLanguage, translate, renderingStage]);

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
    }, 200);

    // Stage 3: Enhanced render with longer delay
    const enhancedTimer = setTimeout(() => {
      try {
        setRenderingStage('enhanced');
        console.log('[SimplifiedSoulNetVisualization] Moving to enhanced stage with HTML overlay');
      } catch (error) {
        console.error('[SimplifiedSoulNetVisualization] Enhanced stage error:', error);
      }
    }, 800);

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
      return connected;
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Highlighted nodes calculation error:', error);
      return new Set<string>();
    }
  }, [selectedNode, validData.links, renderingStage]);

  // Prepare text overlay items
  const textOverlayItems = useMemo(() => {
    if (renderingStage !== 'enhanced' || !shouldShowLabels) return [];

    return validData.nodes.map(node => {
      const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
      const dimmed = !!selectedNode && !isHighlighted;
      
      // Enhanced adaptive text color
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

      // Get label offset based on node type
      const getLabelOffset = (): [number, number, number] => {
        const geometricOffset = node.type === 'entity' 
          ? 1.4 * 1.3  // sphere radius * scale
          : Math.sqrt(3) * (2.1 / 2) * 1.3; // cube corner distance * scale
        
        return [node.position[0], node.position[1] + geometricOffset, node.position[2]];
      };

      const displayText = currentLanguage === 'en' 
        ? node.id 
        : (translatedTexts.get(node.id) || node.id);

      return {
        id: node.id,
        text: displayText,
        position: getLabelOffset(),
        color: getTextColor(),
        size: 0.35 + Math.max(0, (45 - cameraZoom) * 0.007),
        visible: true,
        bold: isHighlighted || selectedNode === node.id,
        isHighlighted,
        isSelected: selectedNode === node.id,
        nodeType: node.type
      };
    });
  }, [validData.nodes, renderingStage, shouldShowLabels, selectedNode, highlightedNodes, theme, cameraZoom, translatedTexts, currentLanguage]);

  // Render nothing during initial stage to prevent flickering
  if (renderingStage === 'initial' || validData.nodes.length === 0) {
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

        {/* Render edges only in enhanced stage to reduce initial load */}
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

        {/* Render nodes with simplified approach */}
        {validData.nodes.map(node => {
          try {
            const isHighlighted = selectedNode === node.id || highlightedNodes.has(node.id);
            const dimmed = !!selectedNode && !isHighlighted;

            return (
              <SimpleNode
                key={`node-${node.id}`}
                node={node}
                isSelected={selectedNode === node.id}
                onClick={(id, e) => {
                  try {
                    onNodeClick(id);
                  } catch (error) {
                    console.error('[SimplifiedSoulNetVisualization] Node click error:', error);
                  }
                }}
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

        {/* HTML Text Overlay for perfect text rendering */}
        {renderingStage === 'enhanced' && (
          <HtmlTextOverlay textItems={textOverlayItems} />
        )}
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
