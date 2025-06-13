
import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import SimplifiedSoulNetVisualization from './soulnet/SimplifiedSoulNetVisualization';
import { SimpleErrorBoundary } from '@/components/error-boundaries/SimpleErrorBoundary';
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
import { LanguageLevelTranslationCache } from '@/services/languageLevelTranslationCache';
import { translationService } from '@/services/translationService';

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

// ENHANCED: Language-level translation loading component
const LanguageLevelTranslationLoadingState: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <h3 className="text-lg font-medium">
        <TranslatableText 
          text="Preparing language translations for Soul-Net..." 
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
          text={`${progress}% complete - This happens once per language`}
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
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { currentLanguage } = useTranslation();
  
  // FIXED: Simplified rendering state - no complex dependency tracking
  const [shouldRender, setShouldRender] = useState(false);
  const currentLanguageRef = useRef(currentLanguage);

  // APP-LEVEL: Initialize the enhanced service with app-level translation service
  useEffect(() => {
    console.log("[SoulNet] APP-LEVEL: Setting up translation service integration");
    try {
      EnhancedSoulNetPreloadService.setAppLevelTranslationService(translationService);
      LanguageLevelTranslationCache.setAppLevelTranslationService(translationService);
    } catch (error) {
      console.error("[SoulNet] Error setting up translation services:", error);
    }
  }, []);

  // ENHANCED: Use the instant data hook with error handling
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

  console.log("[SoulNet] FIXED NODE SELECTION STATE", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData?.nodes?.length || 0,
    isInstantReady,
    loading,
    isTranslating,
    translationProgress,
    translationComplete,
    isAtomicMode,
    shouldRender,
    selectedEntity,
    canvasError: !!canvasError
  });

  // FIXED: Simplified language change handling
  useEffect(() => {
    if (currentLanguageRef.current !== currentLanguage) {
      console.log(`[SoulNet] FIXED: Language changed from ${currentLanguageRef.current} to ${currentLanguage}, resetting render state`);
      setShouldRender(false);
      setSelectedEntity(null); // Clear selection on language change
      currentLanguageRef.current = currentLanguage;
    }
  }, [currentLanguage]);

  // FIXED: Simplified rendering logic - only check for data availability
  useEffect(() => {
    const hasData = graphData?.nodes?.length > 0;
    const readyToRender = isInstantReady && !loading && !error;
    
    console.log("[SoulNet] FIXED RENDER LOGIC", {
      hasData,
      readyToRender,
      isInstantReady,
      loading,
      error: !!error,
      translationComplete,
      currentShouldRender: shouldRender
    });
    
    if (hasData && readyToRender) {
      setShouldRender(true);
    } else if (!hasData || error) {
      setShouldRender(false);
      setSelectedEntity(null); // Clear selection if no data
    }
  }, [graphData?.nodes?.length, isInstantReady, loading, error, translationComplete, shouldRender]);

  // FIXED: Stabilized node selection handler - no dependencies on translation state
  const handleNodeSelect = useCallback((id: string) => {
    console.log(`[SoulNet] FIXED NODE SELECTION: Attempting to select node: ${id}, current selected: ${selectedEntity}`);
    
    if (selectedEntity === id) {
      console.log(`[SoulNet] FIXED NODE SELECTION: Deselecting node: ${id}`);
      setSelectedEntity(null);
    } else {
      console.log(`[SoulNet] FIXED NODE SELECTION: Selecting node: ${id}`);
      setSelectedEntity(id);
      
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [selectedEntity]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      const newValue = !prev;
      if (newValue) {
        console.log("[SoulNet] FIXED: Entering fullscreen, clearing selection");
        setSelectedEntity(null);
      }
      return newValue;
    });
  }, []);

  const handleCanvasError = useCallback((error: Error) => {
    console.error('[SoulNet] FIXED: Canvas error occurred:', error);
    setCanvasError(error);
    setRetryCount(prev => prev + 1);
    setShouldRender(false);
    setSelectedEntity(null); // Clear selection on error
  }, []);

  const handleRetry = useCallback(() => {
    console.log('[SoulNet] FIXED: Retrying after error');
    setCanvasError(null);
    setRetryCount(0);
    setSelectedEntity(null);
  }, []);

  // FIXED: Show language-level translation loading only when actively translating
  if (isTranslating && !translationComplete) {
    console.log("[SoulNet] FIXED: Showing translation loading state");
    return <LanguageLevelTranslationLoadingState progress={translationProgress} />;
  }

  // FIXED: Show loading only when truly loading and no data available
  if (loading && (!graphData?.nodes || graphData.nodes.length === 0)) {
    console.log("[SoulNet] FIXED: Showing general loading state");
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
  
  if (!graphData?.nodes || graphData.nodes.length === 0) return <EmptyState />;

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

  console.log(`[SoulNet] FIXED FINAL RENDER: ${graphData?.nodes?.length || 0} nodes, shouldRender: ${shouldRender}, selectedEntity: ${selectedEntity}`);

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
        <SimpleErrorBoundary
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
          {/* FIXED: Canvas renders when we have data and should render */}
          {shouldRender && graphData?.nodes && graphData.nodes.length > 0 && (
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
                console.log("[SoulNet] FIXED: Canvas pointer missed, clearing selection");
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
                isAtomicMode={isAtomicMode}
              />
            </Canvas>
          )}
        </SimpleErrorBoundary>
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
