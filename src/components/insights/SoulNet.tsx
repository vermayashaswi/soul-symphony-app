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
import { useInstantSoulNetData } from '@/hooks/useInstantSoulNetData';
import { EnhancedSoulNetPreloadService } from '@/services/enhancedSoulNetPreloadService';
import { translationService } from '@/services/translationService';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

// ENHANCED: Atomic Translation Loading Component
const AtomicTranslationLoadingState: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <h3 className="text-lg font-medium">
        <TranslatableText 
          text="Preparing Soul-Net with atomic translations..." 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </h3>
      <div className="w-64 bg-gray-200 rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-sm text-muted-foreground">
        <TranslatableText 
          text={`${progress}% complete`}
          forceTranslate={false}
          enableFontScaling={true}
          scalingContext="general"
        />
      </p>
    </div>
  </div>
);

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderingReady, setRenderingReady] = useState(false);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();
  
  // ENHANCED: Use ref to track atomic rendering initialization
  const atomicRenderingInitialized = useRef(false);

  // APP-LEVEL: Initialize the enhanced service with app-level translation service
  useEffect(() => {
    console.log("[SoulNet] ATOMIC: Setting up atomic app-level translation service integration");
    EnhancedSoulNetPreloadService.setAppLevelTranslationService(translationService);
  }, []);

  // ENHANCED: Use the atomic instant data hook
  const { 
    graphData, 
    loading, 
    error,
    isInstantReady,
    isTranslating,
    translationProgress,
    translationComplete,
    isAtomicMode,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  } = useInstantSoulNetData(userId, timeRange);

  console.log("[SoulNet] ATOMIC TRANSLATION STATE", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData.nodes.length,
    isInstantReady,
    loading,
    isTranslating,
    translationProgress,
    translationComplete,
    isAtomicMode,
    renderingReady,
    atomicInitialized: atomicRenderingInitialized.current
  });

  useEffect(() => {
    console.log("[SoulNet] ATOMIC: Component mounted - Atomic translation mode enabled");
    
    return () => {
      console.log("[SoulNet] ATOMIC: Component unmounted");
    };
  }, []);

  // ENHANCED: Atomic rendering initialization that waits for complete translation
  useEffect(() => {
    // ENHANCED: Only initialize rendering if we have data, atomic translation is complete, and haven't already initialized
    if (isInstantReady && translationComplete && isAtomicMode && graphData.nodes.length > 0 && !atomicRenderingInitialized.current) {
      console.log("[SoulNet] ATOMIC: Initializing rendering after atomic translation completion");
      setRenderingReady(true);
      atomicRenderingInitialized.current = true;
    }
    
    // ENHANCED: Reset rendering if there's an error or complete data loss
    if (error || (graphData.nodes.length === 0 && !loading && !isTranslating && atomicRenderingInitialized.current)) {
      console.log("[SoulNet] ATOMIC: Resetting rendering due to error or data loss", { error: !!error, nodesCount: graphData.nodes.length });
      setRenderingReady(false);
      atomicRenderingInitialized.current = false;
    }
  }, [isInstantReady, translationComplete, isAtomicMode, graphData.nodes.length, loading, error, isTranslating]);

  // OPTIMIZED: Node selection with stable state management
  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] APP-LEVEL STABLE: Node selected: ${id} - no re-render triggers`);
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
      console.log(`[SoulNet] APP-LEVEL: Toggling fullscreen: ${!prev}`);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] APP-LEVEL: Canvas error:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    // DEFENSIVE: Reset rendering state on canvas errors
    setRenderingReady(false);
    atomicRenderingInitialized.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    setCanvasError(null);
    setRetryCount(0);
    // Allow re-initialization after retry
    atomicRenderingInitialized.current = false;
  }, []);

  // ENHANCED: Show atomic translation loading if translation is in progress
  if (isTranslating && !translationComplete && isAtomicMode) {
    console.log("[SoulNet] ATOMIC: Showing atomic translation loading state");
    return <AtomicTranslationLoadingState progress={translationProgress} />;
  }

  // ENHANCED: Only show general loading if we truly have no data and are still loading
  if (loading && !isInstantReady && graphData.nodes.length === 0) {
    console.log("[SoulNet] ATOMIC: Showing general loading state - no atomic instant data available");
    return <LoadingState />;
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

  console.log(`[SoulNet] ATOMIC RENDER: ${graphData.nodes.length} nodes, ${graphData.links.length} links, renderingReady: ${renderingReady}, atomicInitialized: ${atomicRenderingInitialized.current}, translationComplete: ${translationComplete}, atomicMode: ${isAtomicMode}`);

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
          {/* ENHANCED: Canvas only renders when atomic translation is complete and rendering is ready */}
          {renderingReady && translationComplete && isAtomicMode && (
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
                isInstantReady={isInstantReady}
                isAtomicMode={isAtomicMode}
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
