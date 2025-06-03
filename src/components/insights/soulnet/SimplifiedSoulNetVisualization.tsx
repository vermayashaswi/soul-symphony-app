
import React, { useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Node from './Node';
import Edge from './Edge';
import { useTranslation } from '@/contexts/TranslationContext';

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
  data: { nodes: NodeData[], links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  isFullScreen: boolean;
  shouldShowLabels: boolean;
  preloadedTranslations?: Map<string, string>;
  preloadedPercentages?: Map<string, number>;
}

export const SimplifiedSoulNetVisualization: React.FC<SimplifiedSoulNetVisualizationProps> = ({
  data,
  selectedNode,
  onNodeClick,
  themeHex,
  isFullScreen,
  shouldShowLabels,
  preloadedTranslations = new Map(),
  preloadedPercentages = new Map()
}) => {
  const { currentLanguage } = useTranslation();
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimmedNodes, setDimmedNodes] = useState<Set<string>>(new Set());
  const [cameraZoom, setCameraZoom] = useState(45);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  console.log(`[SimplifiedSoulNetVisualization] PRELOADED MODE: Rendering with ${data.nodes.length} nodes, ${preloadedTranslations.size} translations, ${preloadedPercentages.size} percentages`);

  // Detect user's theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setEffectiveTheme(event.matches ? 'dark' : 'light');
    };

    setEffectiveTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Use Three.js controls for camera
  useFrame(({ camera }) => {
    const newZoom = camera.position.length();
    if (Math.abs(newZoom - cameraZoom) > 0.1) {
      setCameraZoom(newZoom);
    }
  });

  // Enhanced highlighting effect when a node is selected
  useEffect(() => {
    if (selectedNode) {
      const connectedNodes = new Set<string>();
      const allOtherNodes = new Set<string>();
      
      data.links.forEach(link => {
        if (link.source === selectedNode || link.target === selectedNode) {
          connectedNodes.add(link.source);
          connectedNodes.add(link.target);
        }
      });
      
      data.nodes.forEach(node => {
        if (!connectedNodes.has(node.id)) {
          allOtherNodes.add(node.id);
        }
      });
      
      setHighlightedNodes(connectedNodes);
      setDimmedNodes(allOtherNodes);
      
      console.log(`[SimplifiedSoulNetVisualization] Selected ${selectedNode}, highlighting ${connectedNodes.size} connected nodes`);
    } else {
      setHighlightedNodes(new Set());
      setDimmedNodes(new Set());
    }
  }, [selectedNode, data.links, data.nodes]);

  // Helper function to get connection percentage for a node
  const getConnectionPercentage = useCallback((nodeId: string): number => {
    if (!selectedNode || selectedNode === nodeId) return 0;
    
    // Check preloaded percentages first
    const preloadedKey = `${selectedNode}-${nodeId}`;
    if (preloadedPercentages.has(preloadedKey)) {
      return preloadedPercentages.get(preloadedKey)!;
    }
    
    // Fallback calculation if not preloaded
    const relevantLinks = data.links.filter(link => 
      (link.source === selectedNode && link.target === nodeId) ||
      (link.target === selectedNode && link.source === nodeId)
    );
    
    if (relevantLinks.length === 0) return 0;
    
    const totalConnectionValue = relevantLinks.reduce((sum, link) => sum + link.value, 0);
    const selectedNodeTotalConnections = data.links
      .filter(link => link.source === selectedNode || link.target === selectedNode)
      .reduce((sum, link) => sum + link.value, 0);
    
    return Math.round((totalConnectionValue / selectedNodeTotalConnections) * 100);
  }, [selectedNode, data.links, preloadedPercentages]);

  // Helper function to get translated text
  const getTranslatedText = useCallback((nodeId: string): string => {
    if (currentLanguage === 'en') return nodeId;
    
    // Use preloaded translations
    const translation = preloadedTranslations.get(nodeId);
    if (translation) {
      console.log(`[SimplifiedSoulNetVisualization] Using preloaded translation for ${nodeId}: ${translation}`);
      return translation;
    }
    
    console.log(`[SimplifiedSoulNetVisualization] No preloaded translation for ${nodeId}, using original`);
    return nodeId;
  }, [currentLanguage, preloadedTranslations]);

  // Helper function to find node by id
  const findNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return data.nodes.find(node => node.id === nodeId);
  }, [data.nodes]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <OrbitControls 
        enablePan={true} 
        enableZoom={true} 
        enableRotate={true}
        minDistance={15}
        maxDistance={120}
        enableDamping={true}
        dampingFactor={0.05}
      />
      
      {data.nodes.map((node) => {
        const isHighlighted = highlightedNodes.has(node.id);
        const isDimmed = dimmedNodes.has(node.id);
        const connectionPercentage = getConnectionPercentage(node.id);
        const showPercentage = selectedNode !== null && isHighlighted && selectedNode !== node.id && connectionPercentage > 0;
        const translatedText = getTranslatedText(node.id);
        
        return (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onClick={onNodeClick}
            highlightedNodes={highlightedNodes}
            showLabel={shouldShowLabels}
            dimmed={isDimmed}
            themeHex={themeHex}
            selectedNodeId={selectedNode}
            cameraZoom={cameraZoom}
            isHighlighted={isHighlighted}
            connectionPercentage={connectionPercentage}
            showPercentage={showPercentage}
            forceShowLabels={shouldShowLabels}
            translatedText={translatedText}
            effectiveTheme={effectiveTheme}
          />
        );
      })}
      
      {data.links.map((link, index) => {
        const sourceNode = findNodeById(link.source);
        const targetNode = findNodeById(link.target);
        
        if (!sourceNode || !targetNode) {
          console.warn(`[SimplifiedSoulNetVisualization] Missing node for link: ${link.source} -> ${link.target}`);
          return null;
        }
        
        return (
          <Edge
            key={`${link.source}-${link.target}-${index}`}
            start={sourceNode.position}
            end={targetNode.position}
            value={link.value}
            isHighlighted={
              selectedNode !== null && 
              (highlightedNodes.has(link.source) || highlightedNodes.has(link.target))
            }
            dimmed={
              selectedNode !== null && 
              !highlightedNodes.has(link.source) && 
              !highlightedNodes.has(link.target)
            }
            startNodeType={sourceNode.type}
            endNodeType={targetNode.type}
          />
        );
      })}
    </>
  );
};

export default SimplifiedSoulNetVisualization;
