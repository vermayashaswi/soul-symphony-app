import { useEffect, useRef } from 'react';
import { useLoadingCoordinator } from './useLoadingCoordinator';

interface HangDetectionOptions {
  maxLoadingTime: number;
  checkInterval: number;
  onHangDetected: (details: HangDetails) => void;
}

interface HangDetails {
  component: string;
  duration: number;
  stackTrace?: string;
  timestamp: number;
}

export const useDebugMonitor = (options: HangDetectionOptions) => {
  const { activeLoaders, hasHungLoader, forceStopAllLoading } = useLoadingCoordinator();
  const lastHangCheck = useRef(0);

  useEffect(() => {
    if (!hasHungLoader) return;

    const now = Date.now();
    if (now - lastHangCheck.current < options.checkInterval) return;

    lastHangCheck.current = now;

    // Find hung loaders
    const hungLoaders = activeLoaders.filter(loader => 
      now - loader.startTime > options.maxLoadingTime
    );

    if (hungLoaders.length > 0) {
      hungLoaders.forEach(loader => {
        const hangDetails: HangDetails = {
          component: loader.component,
          duration: now - loader.startTime,
          timestamp: now,
          stackTrace: new Error().stack
        };

        console.warn('[DebugMonitor] Hang detected:', hangDetails);
        options.onHangDetected(hangDetails);
      });

      // Force stop all loading to prevent app freeze
      forceStopAllLoading('hang-detected');
    }
  }, [activeLoaders, hasHungLoader, options, forceStopAllLoading]);

  const reportHang = (component: string, details?: any) => {
    const hangDetails: HangDetails = {
      component,
      duration: 0,
      timestamp: Date.now(),
      stackTrace: new Error().stack,
      ...details
    };

    console.warn('[DebugMonitor] Manual hang report:', hangDetails);
    options.onHangDetected(hangDetails);
  };

  return {
    reportHang,
    activeLoaders,
    hasHungLoader
  };
};

export const usePerformanceMonitor = () => {
  const performanceRef = useRef({
    componentMountTimes: new Map<string, number>(),
    renderCounts: new Map<string, number>()
  });

  const trackComponentMount = (componentName: string) => {
    performanceRef.current.componentMountTimes.set(componentName, Date.now());
    console.log(`[PerformanceMonitor] ${componentName} mounted`);
  };

  const trackRender = (componentName: string) => {
    const current = performanceRef.current.renderCounts.get(componentName) || 0;
    performanceRef.current.renderCounts.set(componentName, current + 1);
    
    if (current > 10) {
      console.warn(`[PerformanceMonitor] ${componentName} has rendered ${current} times`);
    }
  };

  const getStats = () => ({
    mountTimes: Object.fromEntries(performanceRef.current.componentMountTimes),
    renderCounts: Object.fromEntries(performanceRef.current.renderCounts)
  });

  return {
    trackComponentMount,
    trackRender,
    getStats
  };
};