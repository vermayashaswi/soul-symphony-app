
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
import { LoadingTimeoutService } from '@/services/loadingTimeoutService';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderingReady, setRenderingReady] = useState(false);
  const [showGracefulDegradation, setShowGracefulDegradation] = useState(false);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();
  
  const renderingInitialized = useRef(false);
  const componentMounted = useRef(true);

  // Use the instant data hook with timeout protection
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentMounted.current = false;
      LoadingTimeoutService.clearTimeout('soulnet-component');
    };
  }, []);

  // Reset states when parameters change
  useEffect(() => {
    if (componentMounted.current) {
      setRenderingReady(false);
      setShowGracefulDegradation(false);
      renderingInitialized.current = false;
      setSelectedEntity(null);
      setCanvasError(null);
      setRetryCount(0);
      
      // Start loading timeout for this component
      LoadingTimeoutService.startTimeout({
        component: 'soulnet-component',
        timeout: 10000, // 10 second timeout
        onTimeout: () => {
          if (componentMounted.current) {
            console.log('[SoulNet] Loading timeout - showing graceful degradation');
            setShowGracefulDegradation(true);
          }
        }
      });
    }
  }, [timeRange, currentLanguage]);

  // Enhanced rendering initialization
  useEffect(() => {
    const shouldInitializeRendering = 
      isInstantReady && 
      translationComplete && 
      graphData.nodes.length > 0 && 
      !renderingInitialized.current &&
      !loading &&
      !isTranslating &&
      componentMounted.current;

    if (shouldInitializeRendering) {
      console.log("[SoulNet] Initializing rendering");
      setRenderingReady(true);
      renderingInitialized.current = true;
      LoadingTimeoutService.clearTimeout('soulnet-component');
    }
  }, [isInstantReady, translationComplete, graphData.nodes.length, loading, isTranslating]);

  // Handle node selection
  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] Node selection: ${id}`);
    
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
      if (!prev) {
        setSelectedEntity(null);
      }
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] Canvas error:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    setRenderingReady(false);
    renderingInitialized.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    console.log('[SoulNet] Retrying...');
    setCanvasError(null);
    setRetryCount(0);
    setShowGracefulDegradation(false);
    renderingInitialized.current = false;
  }, []);

  // Show graceful degradation if timeout occurred
  if (showGracefulDegradation) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-yellow-500 text-2xl">⚠️</div>
          <h3 className="text-lg font-medium">
            <TranslatableText 
              text="Soul-Net Taking Longer Than Expected" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            <TranslatableText 
              text="The visualization is loading slowly. You can continue using other insights features or try again later." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            <TranslatableText 
              text="Try Again" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </button>
        </div>
      </div>
    );
  }

  // Show simplified loading for translations
  if (isTranslating && !translationComplete) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <h3 className="text-lg font-medium">
            <TranslatableText 
              text="Preparing Soul-Net..." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
          <div className="w-48 bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-300" 
              style={{ width: `${translationProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  // Show simplified loading for general loading
  if (loading && !isInstantReady && graphData.nodes.length === 0) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <h3 className="text-lg font-medium">
            <TranslatableText 
              text="Loading Soul-Net..." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-red-500 text-2xl">❌</div>
          <h3 className="text-lg font-medium">
            <TranslatableText 
              text="Soul-Net Unavailable" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            <TranslatableText 
              text="Unable to load the visualization. Other insights features remain available." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            <TranslatableText 
              text="Try Again" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </button>
        </div>
      </div>
    );
  }
  
  if (graphData.nodes.length === 0) {
    return <EmptyState />;
  }

  // Show simplified error for excessive canvas errors
  if (canvasError && retryCount > 2) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-yellow-500 text-2xl">⚠️</div>
          <h3 className="text-lg font-medium">
            <TranslatableText 
              text="3D Visualization Unavailable" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            <TranslatableText 
              text="The 3D visualization is having technical issues. Other insights remain available." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            <TranslatableText 
              text="Try Again" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </button>
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
                  className="px-4 py-2 bg-primary text-white rounded-lg mt-4"
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
                console.log('[SoulNet] Canvas pointer missed - clearing selection');
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
