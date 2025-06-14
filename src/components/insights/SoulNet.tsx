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
import { useAtomicSoulNetData } from '@/hooks/useAtomicSoulNetData';
import { useTranslation } from '@/contexts/TranslationContext';

// Translation loader component using status from hook
const SoulNetTranslationLoader: React.FC<{
  progress: number;
  isTranslating: boolean;
  error?: string | null;
}> = ({ progress, isTranslating, error }) => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <h3 className="text-lg font-medium">
        <TranslatableText
          text={error ? "Translation Error" : "Translating Soul-Net..."}
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </h3>
      <div className="w-64 bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress ?? 0}%` }}
        ></div>
      </div>
      <p className="text-sm text-muted-foreground">
        <TranslatableText
          text={error ?? `${Math.round(progress ?? 0)}% complete`}
          forceTranslate={false}
          enableFontScaling={true}
          scalingContext="general"
        />
      </p>
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        <TranslatableText
          text="Translations are cached and will persist across time range changes."
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </p>
    </div>
  </div>
);

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
  const renderingInitialized = useRef(false);

  // Rely fully on the atomic data hook for translations, readiness, and progress
  const {
    graphData,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isTranslating,
    translationProgress,
    translationComplete,
    canRender,
    translations,
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections,
    setNodeTranslations
  } = useAtomicSoulNetData(userId, timeRange);

  const { currentLanguage } = useTranslation();

  // Rendering logic: ready if data is loaded, translation is done, no error, canRender
  useEffect(() => {
    if (
      !loading &&
      graphData.nodes.length > 0 &&
      canRender &&
      !isTranslating &&
      translationComplete &&
      !error &&
      !renderingInitialized.current
    ) {
      setRenderingReady(true);
      renderingInitialized.current = true;
    }

    // Reset if error or data cleared or translation not ready
    if (
      error ||
      !canRender ||
      isTranslating ||
      !translationComplete ||
      graphData.nodes.length === 0
    ) {
      setRenderingReady(false);
      renderingInitialized.current = false;
    }
  }, [
    loading,
    graphData.nodes.length,
    canRender,
    isTranslating,
    translationComplete,
    error
  ]);

  // Reset rendering when timeRange changes
  useEffect(() => {
    if (renderingInitialized.current) {
      setRenderingReady(false);
      renderingInitialized.current = false;
    }
  }, [timeRange]);

  // Node selection
  const handleNodeSelect = useCallback(
    (id: string) => {
      if (selectedEntity === id) {
        setSelectedEntity(null);
      } else {
        setSelectedEntity(id);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    },
    [selectedEntity]
  );

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => {
      if (!prev) setSelectedEntity(null);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    setCanvasError(error);
    setRetryCount((prev) => prev + 1);
    setRenderingReady(false);
    renderingInitialized.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    setCanvasError(null);
    setRetryCount(0);
    renderingInitialized.current = false;
  }, []);

  // Show loading states based on atomic translation state
  if (graphData.nodes.length > 0 && (isTranslating || !translationComplete)) {
    return (
      <SoulNetTranslationLoader
        progress={translationProgress ?? 0}
        isTranslating={isTranslating}
        error={error?.message}
      />
    );
  }

  // Show general loading if we have no data and are still loading
  if (loading && graphData.nodes.length === 0) {
    return <LoadingState />;
  }

  if (error) {
    return (
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
  }

  if (graphData.nodes.length === 0) return <EmptyState />;

  // Canvas error fallback, unchanged
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

  // Console log for diagnostics (optional, comment out in prod)
  // console.log(`[SoulNet] RENDER: ${graphData.nodes.length} nodes, ${graphData.links.length} links, ready: ${renderingReady}, canRender: ${canRender}, translationComplete: ${translationComplete}`);

  return (
    <div
      className={cn(
        "bg-background rounded-xl shadow-sm border w-full",
        isMobile ? "p-0" : "p-6 md:p-8"
      )}
    >
      {!isFullScreen && <SoulNetDescription />}

      <FullscreenWrapper isFullScreen={isFullScreen} toggleFullScreen={toggleFullScreen}>
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
          {/* Render Canvas only if data and translations are ready */}
          {renderingReady && canRender && (
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
                getInstantConnectionPercentage={getConnectionPercentage}
                // Node label translation provided by data hook (up-to-date)
                getInstantTranslation={getNodeTranslation}
                getInstantNodeConnections={getNodeConnections}
                isInstantReady={translationComplete && !isTranslating}
                isAtomicMode={true}
              />
            </Canvas>
          )}
        </RenderingErrorBoundary>
      </FullscreenWrapper>

      {!isFullScreen && (
        <div className="w-full text-center mt-2 px-4 md:px-8">
          <p className="text-xs text-muted-foreground">{getInstructions()}</p>
        </div>
      )}
    </div>
  );
};

export default SoulNet;

// ⚡️ WARNING: This file is nearly 500 lines. Please consider asking for a refactor to split this into smaller components!
