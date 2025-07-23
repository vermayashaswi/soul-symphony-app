
import React, { useState, useEffect, useCallback, useRef } from 'react';

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

// ENHANCED: Translation Loading Component
const TranslationLoadingState: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <h3 className="text-lg font-medium">
        <TranslatableText 
          text="Translating Soul-Net..." 
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
  
  // ENHANCED: Rendering initialization tracking
  const renderingInitialized = useRef(false);
  const lastTimeRange = useRef<string>(timeRange);
  const lastLanguage = useRef<string>(currentLanguage);

  // ENHANCED: Track parameter changes for immediate reset
  useEffect(() => {
    if (lastTimeRange.current !== timeRange || lastLanguage.current !== currentLanguage) {
      console.log(`[SoulNet] PARAMETER CHANGE: timeRange ${lastTimeRange.current} -> ${timeRange}, language ${lastLanguage.current} -> ${currentLanguage}`);
      
      // Immediate rendering reset on parameter change
      setRenderingReady(false);
      renderingInitialized.current = false;
      setSelectedEntity(null);
      
      lastTimeRange.current = timeRange;
      lastLanguage.current = currentLanguage;
    }
  }, [timeRange, currentLanguage]);

  // APP-LEVEL: Initialize the enhanced service
  useEffect(() => {
    console.log("[SoulNet] INITIALIZING: Setting up enhanced translation service");
    EnhancedSoulNetPreloadService.setAppLevelTranslationService(translationService);
  }, []);

  // Use the enhanced instant data hook
  const { 
    graphData, 
    loading, 
    error,
    isInstantReady,
    isTranslating,
    translationProgress,
    translationComplete,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  } = useInstantSoulNetData(userId, timeRange);

  console.log("[SoulNet] ENHANCED STATE", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData.nodes.length,
    isInstantReady,
    loading,
    isTranslating,
    translationProgress,
    translationComplete,
    renderingReady,
    renderingInitialized: renderingInitialized.current
  });

  // ENHANCED: Rendering initialization with proper dependencies
  useEffect(() => {
    const shouldInitializeRendering = 
      isInstantReady && 
      translationComplete && 
      graphData.nodes.length > 0 && 
      !renderingInitialized.current &&
      !loading &&
      !isTranslating;

    if (shouldInitializeRendering) {
      console.log("[SoulNet] INITIALIZING RENDERING: All conditions met");
      setRenderingReady(true);
      renderingInitialized.current = true;
    }
    
    // Reset rendering on data issues
    if ((error || (graphData.nodes.length === 0 && !loading && !isTranslating)) && renderingInitialized.current) {
      console.log("[SoulNet] RESETTING RENDERING: Data issues detected", { 
        hasError: !!error, 
        nodesCount: graphData.nodes.length,
        loading,
        isTranslating
      });
      setRenderingReady(false);
      renderingInitialized.current = false;
    }
  }, [isInstantReady, translationComplete, graphData.nodes.length, loading, error, isTranslating]);

  // ENHANCED: Manual cache refresh handler
  const handleManualRefresh = useCallback(() => {
    if (userId) {
      console.log('[SoulNet] MANUAL REFRESH: Forcing cache invalidation');
      EnhancedSoulNetPreloadService.forceInvalidateCache(userId, timeRange, currentLanguage);
      
      // Reset rendering state
      setRenderingReady(false);
      renderingInitialized.current = false;
      setSelectedEntity(null);
      setCanvasError(null);
      setRetryCount(0);
      
      // Trigger page reload to ensure fresh data
      window.location.reload();
    }
  }, [userId, timeRange, currentLanguage]);

  // SOUL-NET SELECTION FIX: Enhanced node selection with debug logging
  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] SOUL-NET SELECTION FIX: Node selection triggered for ${id}`, {
      currentSelectedEntity: selectedEntity,
      newNodeId: id,
      willToggle: selectedEntity === id,
      willSelect: selectedEntity !== id
    });
    
    if (selectedEntity === id) {
      console.log(`[SoulNet] SOUL-NET SELECTION FIX: Deselecting node ${id}`);
      setSelectedEntity(null);
    } else {
      console.log(`[SoulNet] SOUL-NET SELECTION FIX: Selecting node ${id}`);
      setSelectedEntity(id);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
        console.log(`[SoulNet] SOUL-NET SELECTION FIX: Vibration triggered for node ${id}`);
      }
    }
  }, [selectedEntity]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      if (!prev) {
        console.log(`[SoulNet] SOUL-NET SELECTION FIX: Entering fullscreen, clearing selection`);
        setSelectedEntity(null);
      }
      console.log(`[SoulNet] FULLSCREEN TOGGLE: ${!prev}`);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] CANVAS ERROR:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    setRenderingReady(false);
    renderingInitialized.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    console.log('[SoulNet] RETRY: Resetting error state');
    setCanvasError(null);
    setRetryCount(0);
    renderingInitialized.current = false;
  }, []);

  // ENHANCED: Show translation loading with manual refresh option
  if (isTranslating && !translationComplete) {
    console.log("[SoulNet] SHOWING TRANSLATION LOADING");
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <TranslationLoadingState progress={translationProgress} />
        <div className="mt-4 text-center">
          <button 
            onClick={handleManualRefresh}
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            <TranslatableText 
              text="Force refresh if stuck" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </button>
        </div>
      </div>
    );
  }

  // Show general loading only when truly loading
  if (loading && !isInstantReady && graphData.nodes.length === 0) {
    console.log("[SoulNet] SHOWING GENERAL LOADING");
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <LoadingState />
        <div className="mt-4 text-center">
          <button 
            onClick={handleManualRefresh}
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            <TranslatableText 
              text="Force refresh" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </button>
        </div>
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
      <div className="space-x-2">
        <button 
          className="px-4 py-2 bg-primary text-white rounded-md" 
          onClick={handleRetry}
        >
          <TranslatableText 
            text="Retry" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </button>
        <button 
          className="px-4 py-2 bg-gray-600 text-white rounded-md" 
          onClick={handleManualRefresh}
        >
          <TranslatableText 
            text="Force Refresh" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </button>
      </div>
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

  console.log(`[SoulNet] SOUL-NET SELECTION FIX: Final render - ${graphData.nodes.length} nodes, ${graphData.links.length} links, renderingReady: ${renderingReady}, selectedEntity: ${selectedEntity}`);

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
                <div className="space-x-2 mt-4">
                  <button 
                    className="px-4 py-2 bg-primary text-white rounded-lg"
                    onClick={handleRetry}
                  >
                    <TranslatableText 
                      text="Retry" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="general"
                    />
                  </button>
                  <button 
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg"
                    onClick={handleManualRefresh}
                  >
                    <TranslatableText 
                      text="Force Refresh" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="general"
                    />
                  </button>
                </div>
              </div>
            </div>
          }
        >
          {/* Canvas renders only when fully ready */}
          {renderingReady && translationComplete && (
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
              onPointerMissed={() => {
                console.log('[SoulNet] SOUL-NET SELECTION FIX: Canvas pointer missed - clearing selection');
                setSelectedEntity(null);
              }}
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
