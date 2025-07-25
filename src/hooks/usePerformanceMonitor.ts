import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  backendOperations: Map<string, number[]>;
  slowOperations: string[];
  avgResponseTime: number;
  errorCount: number;
}

interface PerformanceOptions {
  enableLogging?: boolean;
  slowThreshold?: number;
  maxMetrics?: number;
}

/**
 * Hook to monitor backend performance and detect slow operations
 */
export const usePerformanceMonitor = (options: PerformanceOptions = {}) => {
  const {
    enableLogging = true,
    slowThreshold = 2000, // 2 seconds
    maxMetrics = 100
  } = options;

  const metricsRef = useRef<PerformanceMetrics>({
    backendOperations: new Map(),
    slowOperations: [],
    avgResponseTime: 0,
    errorCount: 0
  });

  // Track a backend operation
  const trackOperation = useCallback((operationName: string, duration: number, success: boolean = true) => {
    const metrics = metricsRef.current;
    
    // Track operation times
    if (!metrics.backendOperations.has(operationName)) {
      metrics.backendOperations.set(operationName, []);
    }
    
    const operations = metrics.backendOperations.get(operationName)!;
    operations.push(duration);
    
    // Keep only recent metrics to prevent memory bloat
    if (operations.length > maxMetrics) {
      operations.shift();
    }
    
    // Track slow operations
    if (duration > slowThreshold) {
      metrics.slowOperations.push(`${operationName}: ${duration}ms`);
      if (metrics.slowOperations.length > maxMetrics) {
        metrics.slowOperations.shift();
      }
      
      if (enableLogging) {
        console.warn(`[Performance] Slow operation detected: ${operationName} took ${duration}ms`);
      }
    }
    
    // Track errors
    if (!success) {
      metrics.errorCount++;
    }
    
    // Calculate average response time
    const allDurations = Array.from(metrics.backendOperations.values()).flat();
    metrics.avgResponseTime = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
    
  }, [enableLogging, slowThreshold, maxMetrics]);

  // Create a performance tracker for promises
  const trackPromise = useCallback(<T>(
    operationName: string,
    promise: Promise<T>
  ): Promise<T> => {
    const startTime = Date.now();
    
    return promise
      .then(result => {
        const duration = Date.now() - startTime;
        trackOperation(operationName, duration, true);
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        trackOperation(operationName, duration, false);
        throw error;
      });
  }, [trackOperation]);

  // Track Supabase operations
  const trackSupabaseOperation = useCallback(<T>(
    operation: string,
    promise: Promise<{ data: T; error: any }>
  ): Promise<{ data: T; error: any }> => {
    return trackPromise(`supabase_${operation}`, promise);
  }, [trackPromise]);

  // Track fetch operations
  const trackFetch = useCallback((
    url: string,
    options?: RequestInit
  ): Promise<Response> => {
    const operationName = `fetch_${new URL(url, window.location.origin).pathname}`;
    return trackPromise(operationName, fetch(url, options));
  }, [trackPromise]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const metrics = metricsRef.current;
    
    return {
      totalOperations: Array.from(metrics.backendOperations.values()).reduce((sum, ops) => sum + ops.length, 0),
      slowOperations: [...metrics.slowOperations],
      avgResponseTime: Math.round(metrics.avgResponseTime),
      errorCount: metrics.errorCount,
      operationBreakdown: Object.fromEntries(
        Array.from(metrics.backendOperations.entries()).map(([name, times]) => [
          name,
          {
            count: times.length,
            avgTime: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
            slowCount: times.filter(t => t > slowThreshold).length
          }
        ])
      )
    };
  }, [slowThreshold]);

  // Log performance summary periodically
  useEffect(() => {
    if (!enableLogging) return;

    const interval = setInterval(() => {
      const summary = getPerformanceSummary();
      
      if (summary.totalOperations > 0) {
        console.log('[Performance Summary]', summary);
        
        // Warn about excessive slow operations
        if (summary.slowOperations.length > 5) {
          console.warn('[Performance] Many slow operations detected:', summary.slowOperations);
        }
      }
    }, 30000); // Log every 30 seconds

    return () => clearInterval(interval);
  }, [enableLogging, getPerformanceSummary]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      backendOperations: new Map(),
      slowOperations: [],
      avgResponseTime: 0,
      errorCount: 0
    };
  }, []);

  return {
    trackOperation,
    trackPromise,
    trackSupabaseOperation,
    trackFetch,
    getPerformanceSummary,
    resetMetrics
  };
};
