
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
  
  console.log("[SimplifiedSoulNetVisualization] Render with unified initialization");

  // Validate and prepare data - single source of truth
  const validData = useMemo(() => {
    try {
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        console.warn('[SimplifiedSoulNetVisualization] Invalid data structure');
        return { nodes: [], links: [] };
      }
      return {
        nodes: data.nodes.filter(node => 
          node && 
          node.id && 
          Array.isArray(node.position) && 
          node.position.length === 3 &&
          !node.position.some(coord => isNaN(coord))
        ),
        links: data.links.filter(link => link && link.source && link.target)
      };
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Data validation error:', error);
      return { nodes: [], links: [] };
    }
  }, [data]);

  // Calculate center position for camera targeting
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

  // Single initialization effect with proper cleanup
  useEffect(() => {
    if (validData.nodes.length === 0 || initializationRef.current) return;
    
    console.log('[SimplifiedSoulNetVisualization] Starting unified initialization');
    initializationRef.current = true;

    // Initialize camera position immediately
    try {
      if (camera && validData.nodes.length > 0) {
        const targetZ = isFullScreen ? 40 : 45;
        camera.position.set(centerPosition.x, centerPosition.y, targetZ);
        camera.lookAt(centerPosition.x, centerPosition.y, 0);
        camera.updateProjectionMatrix();
        
        // Single delay for complete initialization
        const initTimer = setTimeout(() => {
          setIsInitialized(true);
          console.log('[SimplifiedSoulNetVisualization] Initialization complete');
        }, 300);

        return () => {
          clearTimeout(initTimer);
        };
      }
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Initialization error:', error);
      initializationRef.current = false;
    }
  }, [camera, validData.nodes, centerPosition, isFullScreen]);

  // Handle text translations separately and safely
  useEffect(() => {
    if (!isInitialized || currentLanguage === 'en' || validData.nodes.length === 0) return;

    const translateTexts = async () => {
      try {
        const newTranslations = new Map<string, string>();
        
        for (const node of validData.nodes) {
          const cached = onDemandTranslationCache.getTranslation(node.id, currentLanguage);
          if (cached) {
            newTranslations.set(node.id, cached);
            continue;
          }

          if (translate) {
            try {
              const translated = await translate(node.id);
              newTranslations.set(node.id, translated);
              onDemandTranslationCache.setTranslation(node.id, translated, currentLanguage);
            } catch (error) {
              console.warn(`Translation error for ${node.id}:`, error);
              newTranslations.set(node.id, node.id);
            }
          } else {
            newTranslations.set(node.id, node.id);
          }
        }
        
        setTranslatedTexts(newTranslations);
      } catch (error) {
        console.error('[SimplifiedSoulNetVisualization] Translation error:', error);
      }
    };

    translateTexts();
  }, [validData.nodes, currentLanguage, translate, isInitialized]);

  // Safe camera zoom tracking
  useFrame(() => {
    try {
      if (camera && isInitialized) {
        const currentZ = camera.position.z;
        if (Math.abs(currentZ - cameraZoom) > 1) {
          setCameraZoom(currentZ);
        }
      }
    } catch (error) {
      console.warn('[SimplifiedSoulNetVisualization] Camera tracking error:', error);
    }
  });

  // Calculate highlighted nodes
  const highlightedNodes = useMemo(() => {
    try {
      if (!selectedNode || !validData.links || !isInitialized) return new Set<string>();
      
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
  }, [selectedNode, validData.links, isInitialized]);

  // Safe node click handler
  const handleNodeClick = useCallback((id: string) => {
    try {
      onNodeClick(id);
    } catch (error) {
      console.error('[SimplifiedSoulNetVisualization] Node click error:', error);
    }
  }, [onNodeClick]);

  // Prepare text overlay items
  const textOverlayItems = useMemo(() => {
    if (!isInitialized || !shouldShowLabels) return [];

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
  }, [validData.nodes, isInitialized, shouldShowLabels, selectedNode, highlightedNodes, theme, cameraZoom, translatedTexts, currentLanguage]);

  // Show loading state during initialization
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

        {/* Render edges */}
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

        {/* Render nodes */}
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

        {/* HTML Text Overlay */}
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
