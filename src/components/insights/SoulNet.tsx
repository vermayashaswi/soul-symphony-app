import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { staticTranslationService } from '@/services/staticTranslationService';
import SoulNetVisualization from './soulnet/SoulNetVisualization';
import LoadingState from './soulnet/LoadingState';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { cn } from '@/lib/utils';
import ErrorBoundary from './ErrorBoundary';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFontLoading } from '@/main';

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

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [graphData, setGraphData] = useState<{nodes: NodeData[], links: LinkData[]}>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { currentLanguage } = useTranslation();
  const [translatedLabels, setTranslatedLabels] = useState<Map<string, string>>(new Map());
  const [renderMode, setRenderMode] = useState<'3d' | '2d'>('3d');
  const [webGLError, setWebGLError] = useState<boolean>(false);
  
  // Access font loading status from context if available
  const fontStatus = useFontLoading ? useFontLoading() : { 
    fontsLoaded: true, 
    fontsError: false,
    devanagariReady: true
  };

  // Detect if we're using Hindi/Devanagari script and adjust rendering accordingly
  useEffect(() => {
    const isHindi = currentLanguage === 'hi';
    // Use 2D mode for Hindi if Devanagari fonts aren't ready
    if (isHindi && !fontStatus.devanagariReady) {
      console.log('Using 2D fallback for Hindi due to font issues');
      setRenderMode('2d');
    } else {
      setRenderMode('3d');
    }
  }, [currentLanguage, fontStatus]);

  console.log("Rendering SoulNet component with userId:", userId, "and timeRange:", timeRange);

  useEffect(() => {
    console.log("SoulNet mounted");
    return () => {
      console.log("SoulNet unmounted");
    };
  }, []);

  // Pre-translate all node labels
  useEffect(() => {
    if (!graphData.nodes.length || currentLanguage === 'en') {
      return;
    }

    const translateLabels = async () => {
      try {
        console.log(`Pre-translating ${graphData.nodes.length} node labels to ${currentLanguage}`);
        const nodeTexts = graphData.nodes.map(node => node.id);
        
        const translations = await staticTranslationService.preTranslate(nodeTexts);
        setTranslatedLabels(translations);
        
        console.log(`Translated ${translations.size} node labels`);
      } catch (error) {
        console.error("Failed to pre-translate node labels:", error);
      }
    };

    translateLabels();
  }, [graphData.nodes, currentLanguage]);

  // Re-translate when language changes
  useEffect(() => {
    if (graphData.nodes.length > 0 && currentLanguage !== 'en') {
      console.log(`Language changed to ${currentLanguage}, re-translating node labels`);
      // Clear current translations to avoid showing wrong language temporarily
      setTranslatedLabels(new Map());
      
      const translateLabels = async () => {
        try {
          const nodeTexts = graphData.nodes.map(node => node.id);
          const translations = await staticTranslationService.preTranslate(nodeTexts);
          setTranslatedLabels(translations);
        } catch (error) {
          console.error("Failed to translate node labels after language change:", error);
        }
      };
      
      translateLabels();
    }
  }, [currentLanguage]);

  useEffect(() => {
    if (!userId) return;

    const fetchEntityEmotionData = async () => {
      setLoading(true);
      setError(null);
      try {
        const startDate = getStartDate(timeRange);
        console.log(`Fetching data from ${startDate.toISOString()} for user ${userId}`);
        
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, entityemotion, "refined text", "transcription text"')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching journal entries:', error);
          throw error;
        }

        console.log(`Fetched ${entries?.length || 0} entries`);
        
        if (!entries || entries.length === 0) {
          setLoading(false);
          setGraphData({ nodes: [], links: [] });
          return;
        }

        const processedData = processEntities(entries);
        console.log("Processed graph data:", processedData);
        setGraphData(processedData);
        
        // Pre-translate node labels when data is loaded
        if (processedData.nodes.length > 0 && currentLanguage !== 'en') {
          try {
            const nodeTexts = processedData.nodes.map(node => node.id);
            const translations = await staticTranslationService.preTranslate(nodeTexts);
            setTranslatedLabels(translations);
            console.log(`Pre-translated ${translations.size} node labels`);
          } catch (err) {
            console.error("Initial translation failed:", err);
          }
        }
      } catch (error) {
        console.error('Error processing entity-emotion data:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
      } finally {
        setLoading(false);
      }
    };

    fetchEntityEmotionData();
  }, [userId, timeRange, currentLanguage]);

  const handleNodeSelect = useCallback((id: string) => {
    console.log(`Node selected: ${id}`);
    if (selectedEntity === id) {
      setSelectedEntity(null);
    } else {
      setSelectedEntity(id);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [selectedEntity]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      // Force clear selected node when toggling fullscreen to reset view
      if (!prev) setSelectedEntity(null);
      return !prev;
    });
  }, []);

  // WebGL error handler
  const handleWebGLError = useCallback(() => {
    console.error("WebGL rendering error detected");
    setWebGLError(true);
    setRenderMode('2d');
  }, []);

  if (loading) return <LoadingState />;
  if (error) return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <h2 className="text-xl font-semibold text-red-600 mb-4">
        <TranslatableText text="Error Loading Soul-Net" />
      </h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button 
        className="px-4 py-2 bg-primary text-white rounded-md" 
        onClick={() => window.location.reload()}
      >
        <TranslatableText text="Retry" />
      </button>
    </div>
  );
  if (graphData.nodes.length === 0) return <EmptyState />;

  // Get appropriate instructions based on device type
  const getInstructions = () => {
    if (isMobile) {
      return <TranslatableText text="Drag to rotate • Pinch to zoom • Tap a node to highlight connections" forceTranslate={true} />;
    }
    return <TranslatableText text="Drag to rotate • Scroll to zoom • Click a node to highlight connections" forceTranslate={true} />;
  };

  // Check if we should show font loading warning
  const showDevanagariWarning = () => {
    return currentLanguage === 'hi' && !fontStatus.devanagariReady && renderMode === '2d';
  };

  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full",
      isMobile ? "p-0" : "p-6 md:p-8"
    )}>
      {!isFullScreen && <SoulNetDescription />}
      
      {/* Font warning for Hindi users */}
      {showDevanagariWarning() && (
        <div className="m-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <TranslatableText text="Optimizing for Hindi text display. Some visual elements may appear simplified." forceTranslate={true} />
          </p>
        </div>
      )}
      
      <FullscreenWrapper
        isFullScreen={isFullScreen}
        toggleFullScreen={toggleFullScreen}
      >
        <ErrorBoundary fallback={
          <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-medium">
                <TranslatableText text="Error in Soul-Net Visualization" forceTranslate={true} />
              </h3>
              <p className="text-muted-foreground mt-2">
                <TranslatableText text="There was a problem rendering the visualization." forceTranslate={true} />
              </p>
              <button 
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
                onClick={() => window.location.reload()}
              >
                <TranslatableText text="Reload" forceTranslate={true} />
              </button>
            </div>
          </div>
        }>
          {renderMode === '3d' ? (
            <Canvas
              style={{
                width: '100%',
                height: '100%',
                maxWidth: isFullScreen ? 'none' : '800px',
                maxHeight: isFullScreen ? 'none' : '500px',
                position: 'relative',
                zIndex: 5,
                transition: 'all 0.3s ease-in-out',
              }}
              camera={{ 
                position: [0, 0, isFullScreen ? 22 : 26], 
                near: 1, 
                far: 1000,
                fov: isFullScreen ? 60 : 50 // Adjust field of view for better fullscreen experience
              }}
              onPointerMissed={() => setSelectedEntity(null)}
              onError={handleWebGLError}
              gl={{ 
                preserveDrawingBuffer: true,
                antialias: !isMobile,
                powerPreference: 'high-performance',
                alpha: true,
                depth: true,
                stencil: false,
                precision: isMobile ? 'mediump' : 'highp',
                logarithmicDepthBuffer: true // Enable logarithmic depth buffer for better z-sorting
              }}
            >
              <SoulNetVisualization
                data={graphData}
                selectedNode={selectedEntity}
                onNodeClick={handleNodeSelect}
                themeHex={themeHex}
                isFullScreen={isFullScreen}
                translatedLabels={translatedLabels}
              />
            </Canvas>
          ) : (
            <div 
              className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4" 
              style={{
                width: '100%',
                height: '100%',
                maxWidth: isFullScreen ? 'none' : '800px',
                maxHeight: isFullScreen ? 'none' : '500px',
                position: 'relative',
              }}
            >
              <FallbackVisualization 
                data={graphData}
                selectedNode={selectedEntity}
                onNodeClick={handleNodeSelect}
                themeHex={themeHex}
                translatedLabels={translatedLabels}
              />
            </div>
          )}
        </ErrorBoundary>
      </FullscreenWrapper>
      
      {!isFullScreen && (
        <div className="w-full text-center mt-2 px-4 md:px-8">
          <p className="text-xs text-muted-foreground">
            {getInstructions()}
          </p>
        </div>
      )}
    </div>
  );
};

// Simple 2D fallback visualization for when WebGL/3D rendering fails
const FallbackVisualization: React.FC<{
  data: { nodes: NodeData[]; links: LinkData[] };
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  themeHex: string;
  translatedLabels?: Map<string, string>;
}> = ({ data, selectedNode, onNodeClick, themeHex, translatedLabels }) => {
  // Calculate which nodes are connected to the selected node
  const connectedNodes = selectedNode 
    ? new Set(data.links
        .filter(link => link.source === selectedNode || link.target === selectedNode)
        .flatMap(link => [link.source, link.target]))
    : new Set();

  if (selectedNode) connectedNodes.add(selectedNode);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <TranslatableText text="Soul Network" />
      </div>
      
      <div className="max-h-full overflow-auto p-4">
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {data.nodes
            .filter(node => node.type === 'entity')
            .map(node => (
              <button 
                key={node.id}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  selectedNode === node.id
                    ? "bg-primary text-white border-primary"
                    : selectedNode && connectedNodes.has(node.id)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : selectedNode
                        ? "opacity-40 border-gray-300 dark:border-gray-700"
                        : "border-gray-300 dark:border-gray-700"
                )}
                onClick={() => onNodeClick(node.id)}
              >
                {translatedLabels?.get(node.id) || node.id}
              </button>
            ))}
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          {data.nodes
            .filter(node => node.type === 'emotion')
            .map(node => (
              <button 
                key={node.id}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  selectedNode === node.id
                    ? "bg-blue-500 text-white border-blue-500"
                    : selectedNode && connectedNodes.has(node.id)
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                      : selectedNode
                        ? "opacity-40 border-gray-300 dark:border-gray-700"
                        : "border-gray-300 dark:border-gray-700"
                )}
                onClick={() => onNodeClick(node.id)}
              >
                {translatedLabels?.get(node.id) || node.id}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

const getStartDate = (range: TimeRange) => {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.setHours(0, 0, 0, 0));
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      return weekStart;
    case 'month':
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - 1);
      return monthStart;
    case 'year':
      const yearStart = new Date(now);
      yearStart.setFullYear(yearStart.getFullYear() - 1);
      return yearStart;
    default:
      const defaultStart = new Date(now);
      defaultStart.setDate(defaultStart.getDate() - 7);
      return defaultStart;
  }
};

const processEntities = (entries: any[]) => {
  console.log("Processing entities for", entries.length, "entries");
  
  const entityEmotionMap: Record<string, {emotions: Record<string, number>}> = {};
  
  entries.forEach(entry => {
    if (!entry.entityemotion) return;
    Object.entries(entry.entityemotion).forEach(([category, emotions]) => {
      if (typeof emotions !== 'object') return;
      Object.entries(emotions).forEach(([emotion, score]) => {
        if (typeof score !== 'number') return;
        if (!entityEmotionMap[category]) {
          entityEmotionMap[category] = { emotions: {} };
        }
        if (entityEmotionMap[category].emotions[emotion]) {
          entityEmotionMap[category].emotions[emotion] =
            (entityEmotionMap[category].emotions[emotion] + score) / 2;
        } else {
          entityEmotionMap[category].emotions[emotion] = score;
        }
      });
    });
  });

  console.log("Entity emotion map:", entityEmotionMap);
  return generateGraph(entityEmotionMap);
};

const generateGraph = (entityEmotionMap: Record<string, {emotions: Record<string, number>}>) => {
  const nodes: NodeData[] = [];
  const links: LinkData[] = [];
  const entityNodes = new Set<string>();
  const emotionNodes = new Set<string>();

  const entityList = Object.keys(entityEmotionMap);
  const EMOTION_LAYER_RADIUS = 11;
  const ENTITY_LAYER_RADIUS = 6;
  const EMOTION_Y_SPAN = 6;
  const ENTITY_Y_SPAN = 3;

  console.log("Generating graph with", entityList.length, "entities");
  
  entityList.forEach((entity, entityIndex) => {
    entityNodes.add(entity);
    const entityAngle = (entityIndex / entityList.length) * Math.PI * 2;
    const entityRadius = ENTITY_LAYER_RADIUS;
    const entityX = Math.cos(entityAngle) * entityRadius;
    const entityY = ((entityIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * ENTITY_Y_SPAN;
    const entityZ = Math.sin(entityAngle) * entityRadius;
    
    nodes.push({
      id: entity,
      type: 'entity',
      value: 1,
      color: '#fff',
      position: [entityX, entityY, entityZ]
    });

    Object.entries(entityEmotionMap[entity].emotions).forEach(([emotion, score]) => {
      emotionNodes.add(emotion);
      links.push({
        source: entity,
        target: emotion,
        value: score
      });
    });
  });

  Array.from(emotionNodes).forEach((emotion, emotionIndex) => {
    const emotionAngle = (emotionIndex / emotionNodes.size) * Math.PI * 2;
    const emotionRadius = EMOTION_LAYER_RADIUS;
    const emotionX = Math.cos(emotionAngle) * emotionRadius;
    const emotionY = ((emotionIndex % 2) === 0 ? -1 : 1) * 0.7 * (Math.random() - 0.5) * EMOTION_Y_SPAN;
    const emotionZ = Math.sin(emotionAngle) * emotionRadius;
    
    nodes.push({
      id: emotion,
      type: 'emotion',
      value: 0.8,
      color: '#fff',
      position: [emotionX, emotionY, emotionZ]
    });
  });

  console.log("Generated graph with", nodes.length, "nodes and", links.length, "links");
  return { nodes, links };
};

export default SoulNet;
