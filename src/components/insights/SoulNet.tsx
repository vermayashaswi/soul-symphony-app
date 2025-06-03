
import React, { useState, useEffect, useCallback } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import SimplifiedSoulNetVisualization from './soulnet/SimplifiedSoulNetVisualization';
import RenderingErrorBoundary from './soulnet/RenderingErrorBoundary';
import { LoadingState } from './soulnet/LoadingState';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { usePreloadedSoulNetData } from '@/hooks/usePreloadedSoulNetData';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderingReady, setRenderingReady] = useState(false);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();

  // Use the new preloaded data hook
  const { 
    graphData, 
    translations, 
    connectionPercentages, 
    loading, 
    error 
  } = usePreloadedSoulNetData(userId, timeRange);

  console.log("[SoulNet] PRELOADED DATA MODE - Using cached translations and percentages", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData.nodes.length,
    translationsCount: translations.size,
    percentagesCount: connectionPercentages.size,
    loading
  });

  useEffect(() => {
    console.log("[SoulNet] Component mounted - Preloaded data mode");
    
    return () => {
      console.log("[SoulNet] Component unmounted");
    };
  }, []);

  // Staged rendering initialization
  useEffect(() => {
    if (graphData.nodes.length > 0 && !renderingReady && !loading) {
      console.log("[SoulNet] Preparing for staged rendering with preloaded data");
      
      // Delay rendering to prevent initialization crashes
      const timer = setTimeout(() => {
        setRenderingReady(true);
        console.log("[SoulNet] Rendering ready with preloaded data");
      }, 100); // Reduced delay since data is already processed
      
      return () => clearTimeout(timer);
    }
  }, [graphData.nodes.length, renderingReady, loading]);

  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] Node selected: ${id}`);
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
      if (!prev) setSelectedEntity(null);
      console.log(`[SoulNet] Toggling fullscreen: ${!prev}`);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] Canvas error:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
  }, []);

  const handleRetry = useCallback(() => {
    setCanvasError(null);
    setRetryCount(0);
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

  // Show simplified error UI for canvas errors
  if (canvasError && retryCount > 2) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          <TranslatableText text="Soul-Net Visualization" />
        </h2>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            <TranslatableText text="3D Visualization Unavailable" />
          </h3>
          <p className="text-yellow-700 dark:text-yellow-400 mb-3">
            <TranslatableText text="The 3D visualization is experiencing technical difficulties. Your data is safe and you can try again." />
          </p>
          <div className="space-x-2">
            <button
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              onClick={handleRetry}
            >
              <TranslatableText text="Try Again" />
            </button>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={() => window.location.reload()}
            >
              <TranslatableText text="Reload Page" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInstructions = () => {
    if (isMobile) {
      return <TranslatableText text="Drag to rotate • Pinch to zoom • Tap a node to highlight connections" forceTranslate={true} />;
    }
    return <TranslatableText text="Drag to rotate • Scroll to zoom • Click a node to highlight connections" forceTranslate={true} />;
  };

  console.log(`[SoulNet] PRELOADED DATA MODE - Final render: ${graphData.nodes.length} nodes, ${graphData.links.length} links, ready: ${renderingReady}, translations: ${translations.size}, percentages: ${connectionPercentages.size}`);

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
        <RenderingErrorBoundary
          onError={handleCanvasError}
          fallback={
            <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  <TranslatableText text="Visualization Error" />
                </h3>
                <p className="text-muted-foreground mt-2">
                  <TranslatableText text="The 3D visualization encountered an error." />
                </p>
                <button 
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
                  onClick={handleRetry}
                >
                  <TranslatableText text="Retry" />
                </button>
              </div>
            </div>
          }
        >
          {renderingReady && (
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
                position: [0, 0, isFullScreen ? 40 : 45],
                near: 1, 
                far: 1000,
                fov: isFullScreen ? 60 : 50
              }}
              onPointerMissed={() => setSelectedEntity(null)}
              gl={{ 
                preserveDrawingBuffer: true,
                antialias: !isMobile,
                powerPreference: 'high-performance',
                alpha: true,
                depth: true,
                stencil: false,
                precision: isMobile ? 'mediump' : 'highp'
              }}
            >
              <SimplifiedSoulNetVisualization
                data={graphData}
                selectedNode={selectedEntity}
                onNodeClick={handleNodeSelect}
                themeHex={themeHex}
                isFullScreen={isFullScreen}
                shouldShowLabels={true}
                preloadedTranslations={translations}
                preloadedPercentages={connectionPercentages}
              />
            </Canvas>
          )}
        </RenderingErrorBoundary>
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

export default SoulNet;
