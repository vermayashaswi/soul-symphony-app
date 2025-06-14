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

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

// OPTIMIZED: Translation loading component with better UX
const OptimizedTranslationLoadingState: React.FC<{ 
  progress: number; 
  isComplete: boolean;
  canRender: boolean;
  message?: string;
}> = ({ progress, isComplete, canRender, message }) => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <h3 className="text-lg font-medium">
        <TranslatableText 
          text={canRender ? "Optimizing Soul-Net translations..." : (message || "Loading Soul-Net translations...")} 
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
          text={`${Math.round(progress)}% complete`}
          forceTranslate={false}
          enableFontScaling={true}
          scalingContext="general"
        />
      </p>
      {canRender && (
        <p className="text-xs text-green-600 text-center max-w-sm">
          <TranslatableText 
            text="Sufficient translations loaded. Rendering visualization..."
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </p>
      )}
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

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderingReady, setRenderingReady] = useState(false);
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const renderingInitialized = useRef(false);

  // -- USE ONLY THE ATOMIC DATA HOOK SYSTEM FOR NODE LABEL TRANSLATION --
  const {
    graphData,
    connectionPercentages,
    nodeConnectionData,
    loading,
    error,
    isTranslating,          // <- Not used for label translation, just for legacy status
    translationProgress,    // <- Not used for node labels, tracked below
    translationComplete,    // <- Likewise, not used for labels progress
    canRender,
    getNodeTranslation,
    getConnectionPercentage,
    getNodeConnections,
    setNodeTranslations
  } = useAtomicSoulNetData(userId, timeRange);

  // Active language and translation system debug
  const { currentLanguage } = useTranslation();

  // Provide node label translation progress state for SoulNet
  const [translationLabelProgress, setTranslationLabelProgress] = useState(100);
  const [nodeLabelTranslations, setNodeLabelTranslations] = useState<Map<string, string>>(new Map());
  const [translationsReady, setTranslationsReady] = useState(true);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Only recalculate node label translations when language or node IDs change
  useEffect(() => {
    const runNodeLabelTranslation = async () => {
      setTranslationsReady(currentLanguage === "en");
      setTranslationLabelProgress(currentLanguage === "en" ? 100 : 0);
      setTranslationError(null);

      if (graphData.nodes.length === 0 || currentLanguage === "en") {
        // English is always a no-op (labels are IDs)
        const m = new Map<string, string>();
        graphData.nodes.forEach(n => m.set(n.id, n.id));
        setNodeLabelTranslations(m);
        setTranslationsReady(true);
        setTranslationLabelProgress(100);
        setNodeTranslations(m);
        return;
      }

      // Try to reuse/preserve older cache
      const prevMap = new Map(nodeLabelTranslations);
      const resultMap = new Map<string, string>();
      let translated = 0;
      let hadError = false;

      for (const node of graphData.nodes) {
        const prev = prevMap.get(node.id);
        if (prev && prev.trim().length > 0) {
          resultMap.set(node.id, prev);
          translated++;
          continue;
        }
        // Translate, fallback to id, respect error
        try {
          // Uses TranslationContext.translate which is robust
          const { translate } = require('@/contexts/TranslationContext').useTranslation();
          const translatedVal = await translate(node.id, "en");
          resultMap.set(node.id, translatedVal || node.id);
        } catch (e) {
          // fallback
          console.warn("[SoulNet] Node label translation error", e);
          resultMap.set(node.id, node.id);
          hadError = true;
        }
        translated++;
        setTranslationLabelProgress(Math.round((translated / Math.max(1, graphData.nodes.length)) * 100));
      }
      setNodeLabelTranslations(resultMap);
      setTranslationsReady(true);
      setTranslationLabelProgress(100);
      setTranslationError(hadError ? "Some node label translations failed." : null);
      setNodeTranslations(resultMap);
    };
    runNodeLabelTranslation();
    // eslint-disable-next-line
  }, [currentLanguage, graphData.nodes.map(n => n.id).join(',')]);

  // Diagnostic logging for translation flow state
  useEffect(() => {
    console.log("[SoulNet] NODE LABEL TRANSLATION STATE", {
      nodeCount: graphData.nodes.length,
      nodeLabelTranslations: nodeLabelTranslations,
      translationLabelProgress,
      translationsReady
    });
  }, [nodeLabelTranslations, translationLabelProgress, translationsReady, graphData.nodes.length]);

  // Rendering logic as before, but tie the label translation loader to local progress state
  useEffect(() => {
    const shouldInitialize = (
      !loading &&
      graphData.nodes.length > 0 &&
      canRender &&
      translationsReady &&
      !renderingInitialized.current
    );
    if (shouldInitialize) {
      setRenderingReady(true);
      renderingInitialized.current = true;
    }
    const shouldReset = (
      error ||
      (!canRender && renderingInitialized.current) ||
      (graphData.nodes.length === 0 && !loading && renderingInitialized.current)
    );
    if (shouldReset) {
      setRenderingReady(false);
      renderingInitialized.current = false;
    }
  }, [loading, graphData.nodes.length, canRender, error, translationsReady]);

  // Reset on time range change also
  useEffect(() => {
    if (renderingInitialized.current) {
      setRenderingReady(false);
      renderingInitialized.current = false;
    }
  }, [timeRange]);

  // Node selection
  const handleNodeSelect = useCallback((id: string) => {
    if (selectedEntity === id) {
      setSelectedEntity(null);
    } else {
      setSelectedEntity(id);
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }, [selectedEntity]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      if (!prev) setSelectedEntity(null);
      return !prev;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    setRenderingReady(false);
    renderingInitialized.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    setCanvasError(null);
    setRetryCount(0);
    renderingInitialized.current = false;
  }, []);

  // Show node label translation loader if needed
  if (graphData.nodes.length > 0 && !translationsReady) {
    return (
      <OptimizedTranslationLoadingState
        progress={translationLabelProgress}
        isComplete={translationsReady}
        canRender={translationsReady}
        message={translationError || undefined}
      />
    );
  }

  // Show general loading if we have no data and are still loading
  if (loading && graphData.nodes.length === 0) {
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

  console.log(`[SoulNet] OPTIMIZED RENDER: ${graphData.nodes.length} nodes, ${graphData.links.length} links, renderingReady: ${renderingReady}, canRender: ${canRender}`);

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
          {/* Canvas renders only when label translations are ready */}
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
                // Node label translation function, now always up to date
                getInstantTranslation={(id: string) => nodeLabelTranslations.get(id) || id}
                getInstantNodeConnections={getNodeConnections}
                isInstantReady={translationsReady}
                isAtomicMode={true}
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
