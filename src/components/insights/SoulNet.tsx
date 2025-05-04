import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { staticTranslationService } from '@/services/staticTranslationService';
import SoulNetVisualization from './soulnet/SoulNetVisualization';
import { LoadingState } from './soulnet/LoadingState';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { cn } from '@/lib/utils';
import ErrorBoundary from './ErrorBoundary';
import { TranslatableText } from '@/components/translation/TranslatableText';
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
  const [isTranslating, setIsTranslating] = useState(false);
  const translationRetryCount = useRef<number>(0);
  const prevLanguageRef = useRef<string>(currentLanguage);
  const mountedRef = useRef<boolean>(true);
  
  // Initialize mount state
  useEffect(() => {
    mountedRef.current = true;
    console.log("SoulNet mounted");
    return () => {
      mountedRef.current = false;
      console.log("SoulNet unmounted");
    };
  }, []);

  // Translate node labels with retry mechanism
  const translateNodeLabels = useCallback(async (nodes: NodeData[]) => {
    if (!nodes.length || currentLanguage === 'en' || !mountedRef.current) return;
    
    try {
      setIsTranslating(true);
      console.log(`Translating ${nodes.length} node labels to ${currentLanguage}`);
      
      const nodeTexts = nodes.map(node => node.id);
      
      // Keep previous translations while loading new ones to prevent flickering
      const newTranslations = await staticTranslationService.preTranslate(nodeTexts);
      
      // Only update if component still mounted
      if (mountedRef.current) {
        setTranslatedLabels(newTranslations);
        console.log(`Received ${newTranslations.size} node label translations`);
        
        // Verify translations are complete
        const verificationResult = staticTranslationService.verifyTranslations(nodeTexts, newTranslations);
        
        // If translations are incomplete, retry up to 2 times
        if (!verificationResult && translationRetryCount.current < 2) {
          translationRetryCount.current++;
          console.warn(`Incomplete translations, retrying (${translationRetryCount.current}/2)...`);
          
          // Wait a moment before retrying
          setTimeout(() => {
            if (mountedRef.current) {
              translateNodeLabels(nodes);
            }
          }, 800 * translationRetryCount.current); // Exponential backoff
        } else {
          translationRetryCount.current = 0;
        }
      }
    } catch (error) {
      console.error("Failed to translate node labels:", error);
      
      // Retry on failure up to 2 times
      if (translationRetryCount.current < 2 && mountedRef.current) {
        translationRetryCount.current++;
        console.warn(`Translation failed, retrying (${translationRetryCount.current}/2)...`);
        
        // Wait before retrying with exponential backoff
        setTimeout(() => {
          if (mountedRef.current) {
            translateNodeLabels(nodes);
          }
        }, 1000 * translationRetryCount.current);
      } else {
        translationRetryCount.current = 0;
      }
    } finally {
      if (mountedRef.current) {
        setIsTranslating(false);
      }
    }
  }, [currentLanguage]);

  // Fetch data and initialize translations
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
        
        // Reset translation retry counter
        translationRetryCount.current = 0;
        
        // Pre-translate node labels when data is loaded
        if (processedData.nodes.length > 0 && mountedRef.current) {
          prevLanguageRef.current = currentLanguage;
          translateNodeLabels(processedData.nodes);
        }
      } catch (error) {
        console.error('Error processing entity-emotion data:', error);
        setError(error instanceof Error ? error : new Error('Unknown error occurred'));
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchEntityEmotionData();
  }, [userId, timeRange, translateNodeLabels]);

  // Re-translate when language changes
  useEffect(() => {
    if (graphData.nodes.length > 0 && currentLanguage !== prevLanguageRef.current && mountedRef.current) {
      console.log(`Language changed from ${prevLanguageRef.current} to ${currentLanguage}, re-translating node labels`);
      
      // Update language reference
      prevLanguageRef.current = currentLanguage;
      
      // Skip if English - no translation needed
      if (currentLanguage !== 'en') {
        // Reset retry counter for new language
        translationRetryCount.current = 0;
        // Translate nodes in the new language
        translateNodeLabels(graphData.nodes);
      } else {
        // For English, reset to original node IDs
        const englishMap = new Map<string, string>();
        graphData.nodes.forEach(node => {
          englishMap.set(node.id, node.id);
        });
        setTranslatedLabels(englishMap);
      }
    }
  }, [currentLanguage, graphData.nodes, translateNodeLabels]);

  // Listen for language change events (for manual language changes)
  useEffect(() => {
    const handleLanguageChange = () => {
      // Force re-translation
      const updatedLang = localStorage.getItem('i18nextLng')?.split('-')[0] || 'en';
      
      if (updatedLang !== prevLanguageRef.current && graphData.nodes.length > 0) {
        console.log(`Language change event detected: ${prevLanguageRef.current} -> ${updatedLang}`);
        prevLanguageRef.current = updatedLang;
        
        if (updatedLang !== 'en') {
          // Reset retry counter
          translationRetryCount.current = 0;
          // Translate with the new language
          translateNodeLabels(graphData.nodes);
        } else {
          // For English, reset to original node IDs
          const englishMap = new Map<string, string>();
          graphData.nodes.forEach(node => {
            englishMap.set(node.id, node.id);
          });
          setTranslatedLabels(englishMap);
        }
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange);
    document.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange);
      document.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, [graphData.nodes, translateNodeLabels]);

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

  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full",
      isMobile ? "p-0" : "p-6 md:p-8"
    )}>
      {!isFullScreen && <SoulNetDescription />}
      
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
          {isTranslating && (
            <div className="absolute top-2 right-2 bg-primary/20 text-foreground text-xs px-2 py-1 rounded-full z-10">
              <TranslatableText text="Translating..." forceTranslate={true} />
            </div>
          )}
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
              position: [0, 0, isFullScreen ? 44 : 52], // Doubled from 22 and 26 to zoom out 2x
              near: 1, 
              far: 1000,
              fov: isFullScreen ? 60 : 50 // Maintained the same FOV
            }}
            onPointerMissed={() => setSelectedEntity(null)}
            gl={{ 
              preserveDrawingBuffer: true,
              antialias: !isMobile,
              powerPreference: 'high-performance',
              alpha: true,
              depth: true,
              stencil: false,
              precision: isMobile ? 'mediump' : 'highp',
              logarithmicDepthBuffer: true // Maintain logarithmic depth buffer for better z-sorting
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
