
import React, { useState, useEffect, useCallback } from 'react';
import '@/types/three-reference';
import { Canvas } from '@react-three/fiber';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import OptimizedSoulNetVisualization from './soulnet/OptimizedSoulNetVisualization';
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

interface SoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const SoulNet: React.FC<SoulNetProps> = ({ userId, timeRange }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const isMobile = useIsMobile();
  const themeHex = useUserColorThemeHex();
  const { currentLanguage } = useTranslation();

  // Quick data check for empty state
  const { graphData, loading, error } = useInstantSoulNetData(userId, timeRange);

  console.log("[SoulNet] OPTIMIZED ZERO-DELAY MODE", { 
    userId, 
    timeRange, 
    currentLanguage,
    nodesCount: graphData.nodes.length
  });

  // Detect user's theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setEffectiveTheme(event.matches ? 'dark' : 'light');
    };

    setEffectiveTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
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

  // Show loading only briefly if needed
  if (loading && graphData.nodes.length === 0) return <LoadingState />;
  
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

  console.log(`[SoulNet] OPTIMIZED FINAL RENDER: Zero-delay node selection enabled`);

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
            <OptimizedSoulNetVisualization
              userId={userId}
              timeRange={timeRange}
              themeHex={themeHex}
              isFullScreen={isFullScreen}
              effectiveTheme={effectiveTheme}
            />
          </Canvas>
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
