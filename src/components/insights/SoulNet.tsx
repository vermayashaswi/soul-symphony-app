
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useFlickerFreeSoulNetData } from '@/hooks/useFlickerFreeSoulNetData';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderingReady, setRenderingReady] = useState(false);
  const [translationRetryCount, setTranslationRetryCount] = useState(0);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();
  
  const stableRenderingRef = useRef(false);

  // Use the data hook without strict translation requirements
  const { 
    graphData, 
    loading, 
    error,
    isReady,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  } = useFlickerFreeSoulNetData(userId, timeRange);

  console.log("[SoulNet] Using GoogleWebTranslate approach", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData.nodes.length,
    isReady,
    loading,
    renderingReady,
    stableRendering: stableRenderingRef.current
  });

  useEffect(() => {
    console.log("[SoulNet] Component mounted with GoogleWebTranslate system");
    
    return () => {
      console.log("[SoulNet] Component unmounted");
    };
  }, []);

  // Simplified rendering initialization - no strict translation requirements
  useEffect(() => {
    if (isReady && graphData.nodes.length > 0 && !stableRenderingRef.current) {
      console.log("[SoulNet] INITIALIZING RENDERING - data ready", {
        isReady,
        currentLanguage
      });
      setRenderingReady(true);
      stableRenderingRef.current = true;
    }
    
    // Reset if there's an error or complete data loss
    if (error || (graphData.nodes.length === 0 && !loading && stableRenderingRef.current)) {
      console.log("[SoulNet] RESETTING due to error or data loss", { error: !!error, nodesCount: graphData.nodes.length });
      setRenderingReady(false);
      stableRenderingRef.current = false;
    }
  }, [isReady, graphData.nodes.length, loading, error, currentLanguage]);

  // Enhanced node selection without re-renders
  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] Node selected: ${id} - stable state management`);
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
    // Reset stable rendering on canvas errors
    setRenderingReady(false);
    stableRenderingRef.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    setCanvasError(null);
    setRetryCount(0);
    // Allow re-initialization after retry
    stableRenderingRef.current = false;
  }, []);

  // Translation retry mechanism
  const handleTranslationRetry = useCallback(() => {
    console.log("[SoulNet] RETRYING translations");
    setTranslationRetryCount(prev => prev + 1);
    setRenderingReady(false);
    stableRenderingRef.current = false;
    
    // Force component re-render to trigger new translations
    setTimeout(() => {
      setRenderingReady(true);
      stableRenderingRef.current = true;
    }, 100);
  }, []);

  // Show loading only when we have no data
  if (loading && graphData.nodes.length === 0) {
    console.log("[SoulNet] SHOWING LOADING - waiting for data");
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <LoadingState />
      </div>
    );
  }
  
  if (error) return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <h2 className="text-xl font-semibold text-red-600 mb-4">
        <TranslatableText 
          text="Error Loading Soul-Net" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button 
        className="px-4 py-2 bg-primary text-white rounded-md" 
        onClick={() => window.location.reload()}
      >
        <TranslatableText 
          text="Retry" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </button>
    </div>
  );
  
  if (graphData.nodes.length === 0) return <EmptyState />;

  // Show simplified error UI for canvas errors
  if (canvasError && retryCount > 2) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          <TranslatableText 
            text="Soul-Net Visualization" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </h2>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            <TranslatableText 
              text="3D Visualization Unavailable" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
          <p className="text-yellow-700 dark:text-yellow-400 mb-3">
            <TranslatableText 
              text="The 3D visualization is experiencing technical difficulties. Your data is safe and you can try again." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
          <div className="space-x-2">
            <button
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              onClick={handleRetry}
            >
              <TranslatableText 
                text="Try Again" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </button>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={() => window.location.reload()}
            >
              <TranslatableText 
                text="Reload Page" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInstructions = () => {
    if (isMobile) {
      return (
        <TranslatableText 
          text="Drag to rotate • Pinch to zoom • Tap a node to highlight connections" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      );
    }
    return (
      <TranslatableText 
        text="Drag to rotate • Scroll to zoom • Click a node to highlight connections" 
        forceTranslate={true}
        enableFontScaling={true}
        scalingContext="general"
      />
    );
  };

  console.log(`[SoulNet] RENDER: ${graphData.nodes.length} nodes, ${graphData.links.length} links, rendering ready: ${renderingReady}, stable: ${stableRenderingRef.current}`);

  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full",
      isMobile ? "p-0" : "p-6 md:p-8"
    )}>
      {!isFullScreen && <SoulNetDescription />}
      
      {/* Translation retry mechanism */}
      {currentLanguage !== 'en' && translationRetryCount < 3 && (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={handleTranslationRetry}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            <TranslatableText 
              text="Refresh Translations" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="compact"
            />
          </Button>
        </div>
      )}
      
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
                  <TranslatableText 
                    text="Visualization Error" 
                    forceTranslate={true}
                    enableFontScaling={true}
                    scalingContext="general"
                  />
                </h3>
                <p className="text-muted-foreground mt-2">
                  <TranslatableText 
                    text="The 3D visualization encountered an error." 
                    forceTranslate={true}
                    enableFontScaling={true}
                    scalingContext="general"
                  />
                </p>
                <button 
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
                  onClick={handleRetry}
                >
                  <TranslatableText 
                    text="Retry" 
                    forceTranslate={true}
                    enableFontScaling={true}
                    scalingContext="general"
                  />
                </button>
              </div>
            </div>
          }
        >
          {/* Canvas renders when data is ready */}
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
                getInstantConnectionPercentage={getInstantConnectionPercentage}
                getInstantTranslation={getInstantTranslation}
                getInstantNodeConnections={getInstantNodeConnections}
                isInstantReady={isReady}
                userId={userId}
                timeRange={timeRange}
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
