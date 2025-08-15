/**
 * Phase 5: Debug and Analytics Integration
 * Adds debugging, conflict detection, and performance monitoring for Android keyboards
 */

import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';
import { useCapacitorAndroidWebViewOptimization } from './use-capacitor-android-webview-optimization';

interface DebugAnalyticsOptions {
  enableConflictDetection?: boolean;
  enablePerformanceTracking?: boolean;
  enableErrorReporting?: boolean;
  enableUsageAnalytics?: boolean;
  debugMode?: boolean;
  reportingEndpoint?: string;
}

interface ConflictEvent {
  type: 'swipe-composition' | 'touch-input' | 'keyboard-gesture' | 'memory-pressure';
  timestamp: number;
  element: string;
  platform: string;
  keyboardType: string;
  resolution: string;
  duration: number;
}

interface PerformanceEvent {
  type: 'input-latency' | 'composition-delay' | 'keyboard-show' | 'keyboard-hide' | 'memory-usage';
  timestamp: number;
  value: number;
  context: Record<string, any>;
}

interface ErrorEvent {
  type: 'composition-failed' | 'keyboard-stuck' | 'input-freeze' | 'swipe-conflict';
  timestamp: number;
  error: string;
  stack?: string;
  context: Record<string, any>;
}

interface UsageEvent {
  type: 'keyboard-interaction' | 'swipe-gesture' | 'composition-session' | 'error-recovery';
  timestamp: number;
  data: Record<string, any>;
}

interface AnalyticsReport {
  conflicts: ConflictEvent[];
  performance: PerformanceEvent[];
  errors: ErrorEvent[];
  usage: UsageEvent[];
  summary: {
    totalConflicts: number;
    averageInputLatency: number;
    keyboardEfficiency: number;
    errorRate: number;
    mostCommonIssue: string;
  };
}

export const useAndroidKeyboardDebugAnalytics = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: DebugAnalyticsOptions = {}
) => {
  const { 
    platform, 
    keyboardType, 
    androidVersion, 
    webViewVersion 
  } = useEnhancedPlatformDetection();

  const capacitorOptimization = useCapacitorAndroidWebViewOptimization(inputRef, {
    debugMode: options.debugMode
  });

  const {
    enableConflictDetection = true,
    enablePerformanceTracking = true,
    enableErrorReporting = true,
    enableUsageAnalytics = true,
    debugMode = false,
    reportingEndpoint
  } = options;

  const analyticsData = useRef({
    conflicts: [] as ConflictEvent[],
    performance: [] as PerformanceEvent[],
    errors: [] as ErrorEvent[],
    usage: [] as UsageEvent[]
  });

  const sessionState = useRef({
    sessionStart: Date.now(),
    keyboardInteractions: 0,
    compositionSessions: 0,
    conflictsResolved: 0,
    errorsRecovered: 0
  });

  // Skip if not Android
  if (platform !== 'android') {
    return {
      isAndroidDebugging: false,
      generateReport: () => null
    };
  }

  // Record conflict event
  const recordConflict = useCallback((
    type: ConflictEvent['type'],
    element: HTMLElement,
    resolution: string,
    duration: number = 0
  ) => {
    if (!enableConflictDetection) return;

    const conflict: ConflictEvent = {
      type,
      timestamp: Date.now(),
      element: `${element.tagName}.${element.className}`,
      platform: `${platform}-${androidVersion}`,
      keyboardType: keyboardType || 'unknown',
      resolution,
      duration
    };

    analyticsData.current.conflicts.push(conflict);
    sessionState.current.conflictsResolved++;

    if (debugMode) {
      console.log('[AndroidKeyboardDebug] Conflict recorded:', conflict);
    }

    // Dispatch conflict event for real-time monitoring
    window.dispatchEvent(new CustomEvent('androidKeyboardConflict', {
      detail: conflict
    }));
  }, [enableConflictDetection, platform, androidVersion, keyboardType, debugMode]);

  // Record performance event
  const recordPerformance = useCallback((
    type: PerformanceEvent['type'],
    value: number,
    context: Record<string, any> = {}
  ) => {
    if (!enablePerformanceTracking) return;

    const performanceEvent: PerformanceEvent = {
      type,
      timestamp: Date.now(),
      value,
      context: {
        ...context,
        platform,
        keyboardType,
        webViewVersion
      }
    };

    analyticsData.current.performance.push(performanceEvent);

    if (debugMode) {
      console.log('[AndroidKeyboardDebug] Performance recorded:', performanceEvent);
    }
  }, [enablePerformanceTracking, platform, keyboardType, webViewVersion, debugMode]);

  // Record error event
  const recordError = useCallback((
    type: ErrorEvent['type'],
    error: string,
    context: Record<string, any> = {},
    stack?: string
  ) => {
    if (!enableErrorReporting) return;

    const errorEvent: ErrorEvent = {
      type,
      timestamp: Date.now(),
      error,
      stack,
      context: {
        ...context,
        platform,
        keyboardType,
        androidVersion,
        webViewVersion,
        sessionState: sessionState.current
      }
    };

    analyticsData.current.errors.push(errorEvent);

    if (debugMode) {
      console.error('[AndroidKeyboardDebug] Error recorded:', errorEvent);
    }

    // Dispatch error event
    window.dispatchEvent(new CustomEvent('androidKeyboardError', {
      detail: errorEvent
    }));
  }, [enableErrorReporting, platform, keyboardType, androidVersion, webViewVersion, debugMode]);

  // Record usage event
  const recordUsage = useCallback((
    type: UsageEvent['type'],
    data: Record<string, any> = {}
  ) => {
    if (!enableUsageAnalytics) return;

    const usageEvent: UsageEvent = {
      type,
      timestamp: Date.now(),
      data: {
        ...data,
        platform,
        keyboardType,
        session: {
          duration: Date.now() - sessionState.current.sessionStart,
          interactions: sessionState.current.keyboardInteractions,
          compositions: sessionState.current.compositionSessions
        }
      }
    };

    analyticsData.current.usage.push(usageEvent);

    if (debugMode) {
      console.log('[AndroidKeyboardDebug] Usage recorded:', usageEvent);
    }
  }, [enableUsageAnalytics, platform, keyboardType, debugMode]);

  // Performance monitoring
  const setupPerformanceMonitoring = useCallback(() => {
    if (!enablePerformanceTracking || !inputRef.current) return;

    const element = inputRef.current;
    let inputStartTime = 0;

    // Input latency measurement
    const measureInputLatency = (e: Event) => {
      if (inputStartTime) {
        const latency = performance.now() - inputStartTime;
        recordPerformance('input-latency', latency, {
          eventType: e.type,
          elementType: element.tagName
        });
      }
      inputStartTime = performance.now();
    };

    // Composition delay measurement
    let compositionStartTime = 0;
    const measureCompositionDelay = (e: CompositionEvent) => {
      if (e.type === 'compositionstart') {
        compositionStartTime = performance.now();
      } else if (e.type === 'compositionend' && compositionStartTime) {
        const delay = performance.now() - compositionStartTime;
        recordPerformance('composition-delay', delay, {
          finalText: e.data,
          keyboardType
        });
      }
    };

    element.addEventListener('input', measureInputLatency);
    element.addEventListener('compositionstart', measureCompositionDelay);
    element.addEventListener('compositionend', measureCompositionDelay);

    return () => {
      element.removeEventListener('input', measureInputLatency);
      element.removeEventListener('compositionstart', measureCompositionDelay);
      element.removeEventListener('compositionend', measureCompositionDelay);
    };
  }, [enablePerformanceTracking, inputRef, recordPerformance, keyboardType]);

  // Conflict detection
  const setupConflictDetection = useCallback(() => {
    if (!enableConflictDetection) return;

    let swipeStartTime = 0;
    let compositionActive = false;

    // Swipe-composition conflict detection
    const handleSwipeStart = (e: CustomEvent) => {
      swipeStartTime = Date.now();
      if (compositionActive) {
        recordConflict('swipe-composition', e.detail.element, 'blocked-swipe');
      }
    };

    const handleCompositionStart = (e: CustomEvent) => {
      compositionActive = true;
      sessionState.current.compositionSessions++;
      
      if (swipeStartTime && Date.now() - swipeStartTime < 500) {
        recordConflict('swipe-composition', e.detail.element, 'blocked-composition', Date.now() - swipeStartTime);
      }
    };

    const handleCompositionEnd = (e: CustomEvent) => {
      compositionActive = false;
      swipeStartTime = 0;
    };

    // Touch-input conflict detection
    const handleTouchInput = (e: TouchEvent) => {
      if (compositionActive && e.target === inputRef.current) {
        recordConflict('touch-input', e.target as HTMLElement, 'touch-during-composition');
      }
    };

    // Memory pressure detection
    const checkMemoryPressure = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usage = memory.usedJSHeapSize / memory.totalJSHeapSize;
        
        if (usage > 0.9) {
          recordConflict('memory-pressure', document.body, 'high-memory-usage');
        }
      }
    };

    window.addEventListener('swipeGestureStart', handleSwipeStart as EventListener);
    window.addEventListener('compositionStarted', handleCompositionStart as EventListener);
    window.addEventListener('compositionEnded', handleCompositionEnd as EventListener);
    window.addEventListener('androidCompositionStart', handleCompositionStart as EventListener);
    window.addEventListener('androidCompositionEnd', handleCompositionEnd as EventListener);
    
    if (inputRef.current) {
      inputRef.current.addEventListener('touchstart', handleTouchInput);
    }

    const memoryInterval = setInterval(checkMemoryPressure, 5000);

    return () => {
      window.removeEventListener('swipeGestureStart', handleSwipeStart as EventListener);
      window.removeEventListener('compositionStarted', handleCompositionStart as EventListener);
      window.removeEventListener('compositionEnded', handleCompositionEnd as EventListener);
      window.removeEventListener('androidCompositionStart', handleCompositionStart as EventListener);
      window.removeEventListener('androidCompositionEnd', handleCompositionEnd as EventListener);
      
      if (inputRef.current) {
        inputRef.current.removeEventListener('touchstart', handleTouchInput);
      }
      
      clearInterval(memoryInterval);
    };
  }, [enableConflictDetection, inputRef, recordConflict]);

  // Error monitoring
  const setupErrorMonitoring = useCallback(() => {
    if (!enableErrorReporting) return;

    // Global error handler
    const handleError = (event: Event) => {
      const errorEvent = event as any;
      if (errorEvent.filename?.includes('input') || errorEvent.message?.includes('keyboard')) {
        recordError('composition-failed', errorEvent.message, {
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
          colno: errorEvent.colno
        }, errorEvent.error?.stack);
      }
    };

    // Custom keyboard error handler
    const handleKeyboardError = (e: CustomEvent) => {
      recordError(e.detail.type, e.detail.error, e.detail.context);
      sessionState.current.errorsRecovered++;
    };

    window.addEventListener('error', handleError);
    window.addEventListener('androidKeyboardError', handleKeyboardError as EventListener);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('androidKeyboardError', handleKeyboardError as EventListener);
    };
  }, [enableErrorReporting, recordError]);

  // Generate analytics report
  const generateReport = useCallback((): AnalyticsReport => {
    const conflicts = analyticsData.current.conflicts;
    const performance = analyticsData.current.performance;
    const errors = analyticsData.current.errors;
    const usage = analyticsData.current.usage;

    // Calculate summary metrics
    const inputLatencies = performance
      .filter(p => p.type === 'input-latency')
      .map(p => p.value);
    
    const averageInputLatency = inputLatencies.length > 0
      ? inputLatencies.reduce((sum, val) => sum + val, 0) / inputLatencies.length
      : 0;

    const errorTypes = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonIssue = Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    const totalInteractions = sessionState.current.keyboardInteractions + 
                            sessionState.current.compositionSessions;
    
    const keyboardEfficiency = totalInteractions > 0 
      ? (totalInteractions - errors.length) / totalInteractions 
      : 1;

    const report: AnalyticsReport = {
      conflicts,
      performance,
      errors,
      usage,
      summary: {
        totalConflicts: conflicts.length,
        averageInputLatency,
        keyboardEfficiency,
        errorRate: totalInteractions > 0 ? errors.length / totalInteractions : 0,
        mostCommonIssue
      }
    };

    if (debugMode) {
      console.log('[AndroidKeyboardDebug] Generated report:', report);
    }

    return report;
  }, [debugMode]);

  // Send report to endpoint
  const sendReport = useCallback(async (report: AnalyticsReport) => {
    if (!reportingEndpoint) return;

    try {
      await fetch(reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...report,
          metadata: {
            platform,
            androidVersion,
            webViewVersion,
            keyboardType,
            timestamp: Date.now()
          }
        })
      });

      if (debugMode) {
        console.log('[AndroidKeyboardDebug] Report sent to endpoint');
      }
    } catch (error) {
      if (debugMode) {
        console.error('[AndroidKeyboardDebug] Failed to send report:', error);
      }
    }
  }, [reportingEndpoint, platform, androidVersion, webViewVersion, keyboardType, debugMode]);

  // Setup all monitoring
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];

    cleanupFunctions.push(setupPerformanceMonitoring() || (() => {}));
    cleanupFunctions.push(setupConflictDetection() || (() => {}));
    cleanupFunctions.push(setupErrorMonitoring() || (() => {}));

    // Periodic reporting
    let reportInterval: NodeJS.Timeout;
    if (reportingEndpoint) {
      reportInterval = setInterval(() => {
        const report = generateReport();
        sendReport(report);
      }, 60000); // Send report every minute
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
      if (reportInterval) {
        clearInterval(reportInterval);
      }
    };
  }, [setupPerformanceMonitoring, setupConflictDetection, setupErrorMonitoring, reportingEndpoint, generateReport, sendReport]);

  // Track keyboard interactions
  useEffect(() => {
    if (!inputRef.current) return;

    const element = inputRef.current;

    const trackInteraction = () => {
      sessionState.current.keyboardInteractions++;
      recordUsage('keyboard-interaction', {
        elementType: element.tagName,
        timestamp: Date.now()
      });
    };

    element.addEventListener('input', trackInteraction);
    element.addEventListener('focus', trackInteraction);

    return () => {
      element.removeEventListener('input', trackInteraction);
      element.removeEventListener('focus', trackInteraction);
    };
  }, [inputRef, recordUsage]);

  return {
    isAndroidDebugging: true,
    generateReport,
    sendReport,
    recordConflict,
    recordPerformance,
    recordError,
    recordUsage,
    analyticsData: analyticsData.current,
    sessionState: sessionState.current,
    capacitorOptimization
  };
};