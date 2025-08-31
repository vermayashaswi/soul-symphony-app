import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { usePlatformDetection } from './use-platform-detection';

interface WebViewOptimization {
  touchActionOptimized: boolean;
  scrollBehaviorOptimized: boolean;
  eventListenersOptimized: boolean;
  deviceSpecificOptimized: boolean;
}

interface DeviceInfo {
  manufacturer?: string;
  model?: string;
  operatingSystem?: string;
  osVersion?: string;
  webViewVersion?: string;
}

/**
 * WebView gesture optimizer that applies device-specific optimizations
 * for better gesture responsiveness in Capacitor apps
 */
export const useWebViewGestureOptimizer = () => {
  const { platform, isNative } = usePlatformDetection();
  const optimizationStateRef = useRef<WebViewOptimization>({
    touchActionOptimized: false,
    scrollBehaviorOptimized: false,
    eventListenersOptimized: false,
    deviceSpecificOptimized: false
  });
  const deviceInfoRef = useRef<DeviceInfo>({});

  // Detect device information for specific optimizations
  const detectDeviceInfo = useCallback(async () => {
    if (!isNative) return;

    try {
      const deviceInfo = await Device.getInfo();
      const userAgent = navigator.userAgent;
      
      // Extract WebView version from user agent
      const webViewMatch = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      const webViewVersion = webViewMatch ? webViewMatch[1] : 'unknown';

      deviceInfoRef.current = {
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        operatingSystem: deviceInfo.operatingSystem,
        osVersion: deviceInfo.osVersion,
        webViewVersion
      };

      console.log('[WebViewGestureOptimizer] Device info:', deviceInfoRef.current);
    } catch (error) {
      console.warn('[WebViewGestureOptimizer] Failed to get device info:', error);
    }
  }, [isNative]);

  // Apply touch action optimizations
  const optimizeTouchActions = useCallback(() => {
    if (optimizationStateRef.current.touchActionOptimized) return;

    const body = document.body;
    const html = document.documentElement;

    // Remove default touch actions that interfere with gestures
    body.style.touchAction = 'pan-x pan-y';
    html.style.touchAction = 'pan-x pan-y';

      // Apply WebView-specific touch optimizations
      if (isNative) {
        (body.style as any).webkitTouchCallout = 'none';
        (body.style as any).webkitUserSelect = 'none';
        (body.style as any).webkitTapHighlightColor = 'transparent';
      
      // Disable overscroll behavior that can interfere with gestures
      body.style.overscrollBehavior = 'none';
      html.style.overscrollBehavior = 'none';
    }

    optimizationStateRef.current.touchActionOptimized = true;
    console.log('[WebViewGestureOptimizer] Touch actions optimized');
  }, [isNative]);

  // Apply scroll behavior optimizations
  const optimizeScrollBehavior = useCallback(() => {
    if (optimizationStateRef.current.scrollBehaviorOptimized) return;

    // Optimize scroll performance for gesture detection
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-overflow-scrolling: touch;
      }
      
      .capacitor-keyboard-visible {
        --keyboard-adjustment: var(--capacitor-keyboard-height, 0px);
      }
      
      .gesture-optimized {
        will-change: transform;
        transform: translateZ(0);
      }
      
      .gesture-container {
        touch-action: pan-x pan-y;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
    `;
    document.head.appendChild(style);

    optimizationStateRef.current.scrollBehaviorOptimized = true;
    console.log('[WebViewGestureOptimizer] Scroll behavior optimized');
  }, []);

  // Apply device-specific optimizations
  const applyDeviceSpecificOptimizations = useCallback(() => {
    if (optimizationStateRef.current.deviceSpecificOptimized) return;
    
    const device = deviceInfoRef.current;
    const body = document.body;

    // Samsung-specific optimizations
    if (device.manufacturer?.toLowerCase().includes('samsung')) {
      body.classList.add('samsung-device');
      // Samsung Internet browser specific fixes
      body.style.setProperty('--samsung-gesture-fix', '1');
    }

    // Xiaomi/MIUI-specific optimizations
    if (device.manufacturer?.toLowerCase().includes('xiaomi')) {
      body.classList.add('xiaomi-device');
      // MIUI WebView specific fixes
      body.style.setProperty('--miui-gesture-fix', '1');
    }

    // OnePlus-specific optimizations
    if (device.manufacturer?.toLowerCase().includes('oneplus')) {
      body.classList.add('oneplus-device');
      // OxygenOS WebView specific fixes
      body.style.setProperty('--oxygenos-gesture-fix', '1');
    }

    // WebView version specific optimizations
    if (device.webViewVersion) {
      const versionNumber = parseInt(device.webViewVersion.split('.')[0]);
      if (versionNumber < 90) {
        body.classList.add('legacy-webview');
        // Apply legacy WebView compatibility fixes
        body.style.setProperty('--legacy-webview-fix', '1');
      }
    }

    optimizationStateRef.current.deviceSpecificOptimized = true;
    console.log('[WebViewGestureOptimizer] Device-specific optimizations applied');
  }, []);

  // Apply event listener optimizations
  const optimizeEventListeners = useCallback(() => {
    if (optimizationStateRef.current.eventListenersOptimized) return;

    // Add global touch event optimization
    const preventDefault = (e: TouchEvent) => {
      // Only prevent default on specific gesture containers
      const target = e.target as Element;
      if (target?.closest('.gesture-container')) {
        const touchCount = e.touches.length;
        if (touchCount === 1) {
          // Single touch - allow gesture detection
          return;
        } else if (touchCount > 1) {
          // Multi-touch - prevent default to avoid conflicts
          e.preventDefault();
        }
      }
    };

    document.addEventListener('touchstart', preventDefault, { passive: false });
    document.addEventListener('touchmove', preventDefault, { passive: false });

    optimizationStateRef.current.eventListenersOptimized = true;
    console.log('[WebViewGestureOptimizer] Event listeners optimized');
  }, []);

  // Initialize all optimizations
  useEffect(() => {
    if (!isNative) return;

    const initializeOptimizations = async () => {
      await detectDeviceInfo();
      optimizeTouchActions();
      optimizeScrollBehavior();
      applyDeviceSpecificOptimizations();
      optimizeEventListeners();
      
      console.log('[WebViewGestureOptimizer] All optimizations applied');
    };

    initializeOptimizations();

    return () => {
      // Cleanup optimizations if needed
      const body = document.body;
      body.classList.remove('samsung-device', 'xiaomi-device', 'oneplus-device', 'legacy-webview');
    };
  }, [isNative, detectDeviceInfo, optimizeTouchActions, optimizeScrollBehavior, applyDeviceSpecificOptimizations, optimizeEventListeners]);

  return {
    optimizationState: optimizationStateRef.current,
    deviceInfo: deviceInfoRef.current,
    isOptimized: Object.values(optimizationStateRef.current).every(Boolean),
    platform,
    isNative
  };
};