import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import SimplifiedSoulNetVisualization from './soulnet/SimplifiedSoulNetVisualization';
import RenderingErrorBoundary from './soulnet/RenderingErrorBoundary';
import { EmptyState } from './soulnet/EmptyState';
import { FullscreenWrapper } from './soulnet/FullscreenWrapper';
import SoulNetDescription from './soulnet/SoulNetDescription';
import { SoulNetErrorHandler } from './soulnet/SoulNetErrorHandler';
import { SoulNetLoadingState } from './soulnet/SoulNetLoadingState';
import { useUserColorThemeHex } from './soulnet/useUserColorThemeHex';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFlickerFreeSoulNetData } from '@/hooks/useFlickerFreeSoulNetData';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderingReady, setRenderingReady] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();
  
  const stableRenderingRef = useRef(false);
  const maxRetryCount = 3;

  // Use the enhanced flicker-free data hook
  const { 
    graphData, 
    loading, 
    error,
    isReady,
    isTranslationsReady,
    translationProgress,
    retryTranslations,
    getInstantConnectionPercentage,
    getInstantTranslation,
    getInstantNodeConnections
  } = useFlickerFreeSoulNetData(userId, timeRange);

  console.log("[SoulNet] UNIFIED STATE:", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData.nodes.length,
    isReady,
    isTranslationsReady,
    translationProgress,
    loading,
    renderingReady,
    stableRendering: stableRenderingRef.current,
    canvasError: !!canvasError,
    retryCount
  });

  // Stable rendering initialization
  useEffect(() => {
    const translationsActuallyReady = currentLanguage === 'en' || (isTranslationsReady && translationProgress === 100);
    
    if (isReady && translationsActuallyReady && graphData.nodes.length > 0 && !stableRenderingRef.current && !canvasError) {
      console.log("[SoulNet] INITIALIZING unified rendering", {
        isReady,
        translationsActuallyReady,
        translationProgress,
        currentLanguage,
        nodesCount: graphData.nodes.length
      });
      setRenderingReady(true);
      stableRenderingRef.current = true;
    }
    
    if (error || (graphData.nodes.length === 0 && !loading && stableRenderingRef.current)) {
      console.log("[SoulNet] RESETTING due to error or data loss", { 
        error: !!error, 
        nodesCount: graphData.nodes.length,
        loading 
      });
      setRenderingReady(false);
      stableRenderingRef.current = false;
    }
  }, [isReady, isTranslationsReady, translationProgress, graphData.nodes.length, loading, error, currentLanguage, canvasError]);

  // Node selection handler
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
    setRenderingReady(false);
    stableRenderingRef.current = false;
  }, []);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setCanvasError(null);
    setRetryCount(0);
    stableRenderingRef.current = false;
    setRenderingReady(false);
    
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  }, []);

  const handleTranslationRetry = useCallback(async () => {
    console.log("[SoulNet] RETRYING translations");
    setIsRetrying(true);
    setRenderingReady(false);
    stableRenderingRef.current = false;
    
    try {
      await retryTranslations();
    } finally {
      setIsRetrying(false);
    }
  }, [retryTranslations]);

  // Loading state
  const shouldShowLoading = loading && (!isReady || (currentLanguage !== 'en' && (!isTranslationsReady || translationProgress < 100))) && graphData.nodes.length === 0;
  
  if (shouldShowLoading || isRetrying) {
    return (
      <SoulNetLoadingState
        translationProgress={translationProgress}
        showTranslationProgress={currentLanguage !== 'en'}
        currentLanguage={currentLanguage}
      />
    );
  }
  
  // Error states
  if (error) {
    return (
      <SoulNetErrorHandler
        error={error}
        onRetry={() => window.location.reload()}
        isLoading={isRetrying}
      />
    );
  }
  
  if (graphData.nodes.length === 0) {
    return <EmptyState />;
  }

  // Translation error state
  if (currentLanguage !== 'en' && !isTranslationsReady) {
    return (
      <SoulNetErrorHandler
        showTranslationError={true}
        onTranslationRetry={handleTranslationRetry}
        isLoading={isRetrying}
      />
    );
  }

  // Canvas error state with retry limit
  if (canvasError && retryCount > maxRetryCount) {
    return (
      <SoulNetErrorHandler
        error={new Error("3D visualization is experiencing technical difficulties. Your data is safe and you can try again.")}
        onRetry={handleRetry}
        isLoading={isRetrying}
      />
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

  console.log(`[SoulNet] UNIFIED RENDERING: ${graphData.nodes.length} nodes, ${graphData.links.length} links, ready: ${renderingReady}`);

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
            <SoulNetErrorHandler
              error={new Error("The 3D visualization encountered an error.")}
              onRetry={handleRetry}
              isLoading={isRetrying}
            />
          }
        >
          {renderingReady && (currentLanguage === 'en' || isTranslationsReady) && (
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
                isInstantReady={isReady && (currentLanguage === 'en' || isTranslationsReady)}
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
