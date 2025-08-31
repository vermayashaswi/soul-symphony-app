import { useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePlatformDetection } from './use-platform-detection';
import { useCapacitorGestureBridge } from './use-capacitor-gesture-bridge';
import { useEnhancedSwipeGestures } from './use-enhanced-swipe-gestures';

interface DualModeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;
  debugMode?: boolean;
}

/**
 * Dual-mode gesture detection hook that automatically switches between
 * browser-optimized and Capacitor WebView-optimized gesture detection
 */
export const useDualModeGestureDetection = (options: DualModeGestureOptions) => {
  const { platform, isNative } = usePlatformDetection();
  const elementRef = useRef<HTMLDivElement>(null);

  // Enhanced Capacitor-specific gesture detection
  const capacitorGesture = useCapacitorGestureBridge({
    elementRef,
    ...options,
    debugMode: options.debugMode
  });

  // Standard browser gesture detection (fallback and non-native)
  const browserGestureRef = useEnhancedSwipeGestures({
    ...options,
    disabled: isNative || options.disabled, // Disable browser gestures in native
    debugMode: options.debugMode
  });

  // Auto-selection logic
  const getActiveRef = useCallback(() => {
    if (isNative && Capacitor.isPluginAvailable('Keyboard')) {
      return elementRef; // Use Capacitor-optimized detection
    }
    return browserGestureRef; // Use browser-optimized detection
  }, [isNative, browserGestureRef]);

  const activeRef = getActiveRef();

  if (options.debugMode) {
    console.log('[DualModeGestureDetection] Mode:', isNative ? 'Capacitor' : 'Browser', 'Platform:', platform);
  }

  return {
    ref: activeRef,
    mode: isNative ? 'capacitor' : 'browser',
    platform,
    isNative,
    capacitorStatus: isNative ? {
      isKeyboardVisible: capacitorGesture.isKeyboardVisible,
      gestureBlocked: capacitorGesture.gestureBlocked,
      webViewMetrics: capacitorGesture.webViewMetrics
    } : null
  };
};