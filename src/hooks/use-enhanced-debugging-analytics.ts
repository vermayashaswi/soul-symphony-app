import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface DebugEvent {
  timestamp: number;
  type: string;
  platform: string;
  data: any;
  source: string;
}

interface AnalyticsOptions {
  enablePerformanceMonitoring?: boolean;
  enableInputTracking?: boolean;
  enableGestureTracking?: boolean;
  enableErrorTracking?: boolean;
  maxEventHistory?: number;
  debugMode?: boolean;
}

export const useEnhancedDebuggingAnalytics = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: AnalyticsOptions = {}
) => {
  const { platform, keyboardType, androidVersion, iosVersion, webViewVersion } = useEnhancedPlatformDetection();
  const {
    enablePerformanceMonitoring = true,
    enableInputTracking = true,
    enableGestureTracking = true,
    enableErrorTracking = true,
    maxEventHistory = 100,
    debugMode = false
  } = options;

  const eventHistory = useRef<DebugEvent[]>([]);
  const performanceMetrics = useRef<Map<string, number[]>>(new Map());
  const sessionStartTime = useRef(Date.now());

  const addEvent = useCallback((type: string, data: any, source: string = 'unknown') => {
    const event: DebugEvent = {
      timestamp: Date.now(),
      type,
      platform,
      data: {
        ...data,
        keyboardType,
        androidVersion,
        iosVersion,
        webViewVersion
      },
      source
    };

    eventHistory.current.push(event);

    // Maintain max history
    if (eventHistory.current.length > maxEventHistory) {
      eventHistory.current = eventHistory.current.slice(-maxEventHistory);
    }

    if (debugMode) {
      console.log(`[Analytics:${platform}] ${type}:`, event);
    }

    // Dispatch for external listeners
    window.dispatchEvent(new CustomEvent('debugAnalyticsEvent', { detail: event }));
  }, [platform, keyboardType, androidVersion, iosVersion, webViewVersion, maxEventHistory, debugMode]);

  const trackPerformance = useCallback((metric: string, value: number) => {
    if (!enablePerformanceMonitoring) return;

    if (!performanceMetrics.current.has(metric)) {
      performanceMetrics.current.set(metric, []);
    }

    const values = performanceMetrics.current.get(metric)!;
    values.push(value);

    // Keep only last 50 values
    if (values.length > 50) {
      values.splice(0, values.length - 50);
    }

    // Calculate average and log if concerning
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    if (debugMode && (
      (metric === 'inputDelay' && average > 50) ||
      (metric === 'keyboardShowTime' && average > 1000) ||
      (metric === 'gestureResponseTime' && average > 100)
    )) {
      console.warn(`[Analytics:${platform}] Performance issue - ${metric}: ${average.toFixed(2)}ms avg`);
    }

    addEvent('performance_metric', { metric, value, average }, 'performance-tracker');
  }, [enablePerformanceMonitoring, platform, debugMode, addEvent]);

  // Input tracking
  useEffect(() => {
    if (!enableInputTracking || !inputRef.current) return;

    const element = inputRef.current;
    let inputStartTime = 0;
    let lastInputValue = '';
    let inputEventCount = 0;

    const trackInputStart = (e: FocusEvent) => {
      inputStartTime = performance.now();
      lastInputValue = element.value;
      inputEventCount = 0;

      addEvent('input_focus', {
        elementType: element.tagName.toLowerCase(),
        hasValue: element.value.length > 0,
        timestamp: inputStartTime
      }, 'input-tracker');
    };

    const trackInputChange = (e: Event) => {
      const inputDelay = performance.now() - inputStartTime;
      inputEventCount++;

      trackPerformance('inputDelay', inputDelay);

      addEvent('input_change', {
        valueLength: element.value.length,
        eventCount: inputEventCount,
        delay: inputDelay
      }, 'input-tracker');
    };

    const trackInputEnd = (e: FocusEvent) => {
      const totalInputTime = performance.now() - inputStartTime;
      const valueChanged = element.value !== lastInputValue;

      addEvent('input_blur', {
        totalTime: totalInputTime,
        finalValueLength: element.value.length,
        valueChanged,
        totalEvents: inputEventCount
      }, 'input-tracker');

      trackPerformance('totalInputTime', totalInputTime);
    };

    element.addEventListener('focus', trackInputStart);
    element.addEventListener('input', trackInputChange);
    element.addEventListener('blur', trackInputEnd);

    return () => {
      element.removeEventListener('focus', trackInputStart);
      element.removeEventListener('input', trackInputChange);
      element.removeEventListener('blur', trackInputEnd);
    };
  }, [enableInputTracking, inputRef, addEvent, trackPerformance]);

  // Gesture tracking
  useEffect(() => {
    if (!enableGestureTracking) return;

    let gestureStartTime = 0;
    let gestureStartPosition = { x: 0, y: 0 };

    const trackGestureStart = (e: TouchEvent) => {
      gestureStartTime = performance.now();
      gestureStartPosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };

      addEvent('gesture_start', {
        touches: e.touches.length,
        position: gestureStartPosition
      }, 'gesture-tracker');
    };

    const trackGestureEnd = (e: TouchEvent) => {
      const gestureTime = performance.now() - gestureStartTime;
      const endPosition = e.changedTouches[0] ? {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      } : gestureStartPosition;

      const distance = Math.sqrt(
        Math.pow(endPosition.x - gestureStartPosition.x, 2) +
        Math.pow(endPosition.y - gestureStartPosition.y, 2)
      );

      trackPerformance('gestureResponseTime', gestureTime);

      addEvent('gesture_end', {
        duration: gestureTime,
        distance,
        startPosition: gestureStartPosition,
        endPosition
      }, 'gesture-tracker');
    };

    document.addEventListener('touchstart', trackGestureStart, { passive: true });
    document.addEventListener('touchend', trackGestureEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', trackGestureStart);
      document.removeEventListener('touchend', trackGestureEnd);
    };
  }, [enableGestureTracking, addEvent, trackPerformance]);

  // Error tracking
  useEffect(() => {
    if (!enableErrorTracking) return;

    const trackError = (event: ErrorEvent) => {
      addEvent('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }, 'error-tracker');
    };

    const trackUnhandledRejection = (event: PromiseRejectionEvent) => {
      addEvent('unhandled_rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      }, 'error-tracker');
    };

    const trackCustomErrors = (event: CustomEvent) => {
      addEvent('custom_error', event.detail, 'error-tracker');
    };

    window.addEventListener('error', trackError);
    window.addEventListener('unhandledrejection', trackUnhandledRejection);
    window.addEventListener('keyboardError', trackCustomErrors as EventListener);
    window.addEventListener('gestureConflict', trackCustomErrors as EventListener);

    return () => {
      window.removeEventListener('error', trackError);
      window.removeEventListener('unhandledrejection', trackUnhandledRejection);
      window.removeEventListener('keyboardError', trackCustomErrors as EventListener);
      window.removeEventListener('gestureConflict', trackCustomErrors as EventListener);
    };
  }, [enableErrorTracking, addEvent]);

  // Keyboard-specific tracking
  useEffect(() => {
    let keyboardShowTime = 0;

    const trackKeyboardShow = (e: CustomEvent) => {
      keyboardShowTime = performance.now();
      
      addEvent('keyboard_show', {
        height: e.detail?.height,
        trigger: 'system'
      }, 'keyboard-tracker');
    };

    const trackKeyboardHide = (e: CustomEvent) => {
      const keyboardDuration = performance.now() - keyboardShowTime;
      
      trackPerformance('keyboardShowTime', keyboardDuration);
      
      addEvent('keyboard_hide', {
        duration: keyboardDuration
      }, 'keyboard-tracker');
    };

    // Platform-specific keyboard events
    if (platform === 'android') {
      window.addEventListener('androidKeyboardShow', trackKeyboardShow as EventListener);
      window.addEventListener('androidKeyboardHide', trackKeyboardHide as EventListener);
    } else if (platform === 'ios') {
      window.addEventListener('iosKeyboardShow', trackKeyboardShow as EventListener);
      window.addEventListener('iosKeyboardHide', trackKeyboardHide as EventListener);
    }

    return () => {
      if (platform === 'android') {
        window.removeEventListener('androidKeyboardShow', trackKeyboardShow as EventListener);
        window.removeEventListener('androidKeyboardHide', trackKeyboardHide as EventListener);
      } else if (platform === 'ios') {
        window.removeEventListener('iosKeyboardShow', trackKeyboardShow as EventListener);
        window.removeEventListener('iosKeyboardHide', trackKeyboardHide as EventListener);
      }
    };
  }, [platform, addEvent, trackPerformance]);

  // Generate analytics report
  const generateReport = useCallback(() => {
    const sessionDuration = Date.now() - sessionStartTime.current;
    const errorEvents = eventHistory.current.filter(e => e.type.includes('error'));
    const performanceIssues = eventHistory.current.filter(e => 
      e.type === 'performance_metric' && 
      ((e.data.metric === 'inputDelay' && e.data.average > 50) ||
       (e.data.metric === 'gestureResponseTime' && e.data.average > 100))
    );

    const report = {
      sessionDuration,
      platform,
      keyboardType,
      androidVersion,
      iosVersion,
      webViewVersion,
      totalEvents: eventHistory.current.length,
      errorCount: errorEvents.length,
      performanceIssueCount: performanceIssues.length,
      eventHistory: eventHistory.current,
      performanceMetrics: Object.fromEntries(performanceMetrics.current),
      summary: {
        averageInputDelay: performanceMetrics.current.get('inputDelay')?.reduce((a, b) => a + b, 0) / (performanceMetrics.current.get('inputDelay')?.length || 1),
        averageGestureResponseTime: performanceMetrics.current.get('gestureResponseTime')?.reduce((a, b) => a + b, 0) / (performanceMetrics.current.get('gestureResponseTime')?.length || 1),
        averageKeyboardShowTime: performanceMetrics.current.get('keyboardShowTime')?.reduce((a, b) => a + b, 0) / (performanceMetrics.current.get('keyboardShowTime')?.length || 1)
      }
    };

    if (debugMode) {
      console.log(`[Analytics:${platform}] Session Report:`, report);
    }

    return report;
  }, [platform, keyboardType, androidVersion, iosVersion, webViewVersion, debugMode]);

  // Expose global debugging function
  useEffect(() => {
    (window as any).getInputAnalytics = generateReport;
    (window as any).getInputEvents = () => eventHistory.current;
    (window as any).getPerformanceMetrics = () => Object.fromEntries(performanceMetrics.current);

    return () => {
      delete (window as any).getInputAnalytics;
      delete (window as any).getInputEvents;
      delete (window as any).getPerformanceMetrics;
    };
  }, [generateReport]);

  return {
    addEvent,
    trackPerformance,
    generateReport,
    eventHistory: eventHistory.current,
    performanceMetrics: performanceMetrics.current,
    platform,
    keyboardType
  };
};
