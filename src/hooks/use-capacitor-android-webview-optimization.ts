/**
 * Phase 4: Android WebView Optimizations
 * Implements Capacitor-specific optimizations, keyboard height detection, and version-specific workarounds
 */

import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';
import { useUnifiedTouchActionManager } from './use-unified-touch-action-manager';

interface CapacitorOptimizationOptions {
  enableKeyboardPlugin?: boolean;
  enableStatusBarAdjustment?: boolean;
  enableWebViewWorkarounds?: boolean;
  enablePerformanceOptimization?: boolean;
  enableMemoryManagement?: boolean;
  debugMode?: boolean;
}

interface WebViewInfo {
  version: string;
  brand: string;
  hasKnownIssues: boolean;
  workaroundsApplied: string[];
}

interface KeyboardInfo {
  height: number;
  isVisible: boolean;
  resizeMode: 'ionic' | 'native' | 'body' | 'none';
  safeAreaAdjustment: number;
}

export const useCapacitorAndroidWebViewOptimization = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: CapacitorOptimizationOptions = {}
) => {
  const { 
    platform, 
    androidVersion, 
    webViewVersion, 
    keyboardType,
    isNative 
  } = useEnhancedPlatformDetection();

  const touchActionManager = useUnifiedTouchActionManager({
    debugMode: options.debugMode,
    respectCapacitorNative: true
  });

  const {
    enableKeyboardPlugin = true,
    enableStatusBarAdjustment = true,
    enableWebViewWorkarounds = true,
    enablePerformanceOptimization = true,
    enableMemoryManagement = true,
    debugMode = false
  } = options;

  const webViewInfo = useRef<WebViewInfo>({
    version: webViewVersion || 'unknown',
    brand: 'unknown',
    hasKnownIssues: false,
    workaroundsApplied: []
  });

  const keyboardInfo = useRef<KeyboardInfo>({
    height: 0,
    isVisible: false,
    resizeMode: 'none',
    safeAreaAdjustment: 0
  });

  const performanceMetrics = useRef({
    inputLatency: 0,
    renderTime: 0,
    memoryUsage: 0,
    lastOptimization: 0
  });

  // Skip if not Android or not Capacitor
  if (platform !== 'android' || !isNative) {
    return {
      isCapacitorAndroid: false,
      webViewInfo: null,
      keyboardInfo: null
    };
  }

  // Detect WebView brand and known issues
  const analyzeWebView = useCallback(() => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome/')) {
      webViewInfo.current.brand = 'chrome';
    } else if (userAgent.includes('Samsung')) {
      webViewInfo.current.brand = 'samsung';
    } else if (userAgent.includes('Huawei')) {
      webViewInfo.current.brand = 'huawei';
    } else {
      webViewInfo.current.brand = 'system';
    }

    // Check for known problematic versions
    const chromeVersion = userAgent.match(/Chrome\/(\d+)/)?.[1];
    if (chromeVersion) {
      const version = parseInt(chromeVersion, 10);
      
      // Known issues with specific Chrome WebView versions
      if (version >= 100 && version <= 103) {
        webViewInfo.current.hasKnownIssues = true;
        webViewInfo.current.workaroundsApplied.push('chrome-100-103-keyboard-fix');
      }
    }

    if (debugMode) {
      console.log('[CapacitorOptimization] WebView analyzed:', webViewInfo.current);
    }
  }, [debugMode]);

  // Capacitor Keyboard Plugin integration
  const setupKeyboardPlugin = useCallback(async () => {
    if (!enableKeyboardPlugin || !(window as any).Capacitor?.Plugins?.Keyboard) return;

    try {
      const { Keyboard } = (window as any).Capacitor.Plugins;
      
      // Configure keyboard behavior
      await Keyboard.setAccessoryBarVisible({ isVisible: false });
      await Keyboard.setScroll({ isDisabled: false });
      await Keyboard.setStyle({ style: 'DARK' });
      await Keyboard.setResizeMode({ mode: 'native' });
      keyboardInfo.current.resizeMode = 'native';

      // Keyboard show handler
      await Keyboard.addListener('keyboardWillShow', (info) => {
        keyboardInfo.current.height = info.keyboardHeight;
        keyboardInfo.current.isVisible = true;

        // Apply CSS variables for layout
        document.documentElement.style.setProperty('--capacitor-keyboard-height', `${info.keyboardHeight}px`);
        document.documentElement.style.setProperty('--capacitor-keyboard-visible', '1');

        // Apply input optimizations
        if (inputRef.current) {
          touchActionManager.optimizeForAndroidKeyboard(inputRef.current);
          
          // Capacitor-specific input optimizations
          inputRef.current.style.paddingBottom = `${info.keyboardHeight * 0.1}px`;
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (debugMode) {
          console.log('[CapacitorOptimization] Keyboard will show:', info);
        }

        window.dispatchEvent(new CustomEvent('capacitorKeyboardShow', {
          detail: { height: info.keyboardHeight, keyboardInfo: keyboardInfo.current }
        }));
        // Compatibility event for other modules
        window.dispatchEvent(new CustomEvent('keyboardOpen', {
          detail: { height: info.keyboardHeight }
        }));
      });

      // Keyboard hide handler
      await Keyboard.addListener('keyboardDidHide', () => {
        keyboardInfo.current.height = 0;
        keyboardInfo.current.isVisible = false;

        // Remove CSS variables
        document.documentElement.style.removeProperty('--capacitor-keyboard-height');
        document.documentElement.style.removeProperty('--capacitor-keyboard-visible');

        // Remove input optimizations
        if (inputRef.current) {
          inputRef.current.style.paddingBottom = '';
        }

        if (debugMode) {
          console.log('[CapacitorOptimization] Keyboard hidden');
        }

        window.dispatchEvent(new CustomEvent('capacitorKeyboardHide', {
          detail: { keyboardInfo: keyboardInfo.current }
        }));
        // Compatibility event for other modules
        window.dispatchEvent(new CustomEvent('keyboardClose'));
      });

      if (debugMode) {
        console.log('[CapacitorOptimization] Keyboard plugin configured');
      }
    } catch (error) {
      if (debugMode) {
        console.warn('[CapacitorOptimization] Keyboard plugin setup failed:', error);
      }
    }
  }, [enableKeyboardPlugin, inputRef, touchActionManager, debugMode]);

  // Status bar adjustment for keyboard
  const setupStatusBarAdjustment = useCallback(async () => {
    if (!enableStatusBarAdjustment || !(window as any).Capacitor?.Plugins?.StatusBar) return;

    try {
      const { StatusBar } = (window as any).Capacitor.Plugins;
      
      // Get status bar info
      const info = await StatusBar.getInfo();
      keyboardInfo.current.safeAreaAdjustment = info.height || 0;

      // Set status bar style for better keyboard interaction
      await StatusBar.setStyle({ style: 'DARK' });
      await StatusBar.setOverlaysWebView({ overlay: false });

      if (debugMode) {
        console.log('[CapacitorOptimization] Status bar configured:', info);
      }
    } catch (error) {
      if (debugMode) {
        console.warn('[CapacitorOptimization] Status bar setup failed:', error);
      }
    }
  }, [enableStatusBarAdjustment, debugMode]);

  // Apply WebView-specific workarounds
  const applyWebViewWorkarounds = useCallback(() => {
    if (!enableWebViewWorkarounds || !inputRef.current) return;

    const element = inputRef.current;

    // Chrome WebView 100-103 keyboard issue fix
    if (webViewInfo.current.workaroundsApplied.includes('chrome-100-103-keyboard-fix')) {
      element.style.webkitAppearance = 'none';
      element.style.appearance = 'none';
      element.style.borderRadius = '0';
      element.style.border = 'none';
      element.style.outline = 'none';
      
      // Force hardware acceleration
      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'contents';
    }

    // Samsung WebView optimizations
    if (webViewInfo.current.brand === 'samsung') {
      (element.style as any).webkitTouchCallout = 'none';
      (element.style as any).webkitUserSelect = 'text';
      (element.style as any).webkitTapHighlightColor = 'transparent';
    }

    // Huawei WebView optimizations
    if (webViewInfo.current.brand === 'huawei') {
      element.style.touchAction = 'manipulation';
      element.style.userSelect = 'text';
    }

    // Android version-specific fixes
    if (androidVersion) {
      const version = parseFloat(androidVersion);
      
      if (version < 8.0) {
        // Legacy Android keyboard handling
        element.style.webkitAppearance = 'textfield';
        (element.style as any).webkitWritingMode = 'horizontal-tb';
      } else if (version >= 12.0) {
        // Modern Android optimizations
        (element.style as any).imeMode = 'active';
        element.setAttribute('inputmode', 'text');
      }
    }

    if (debugMode) {
      console.log('[CapacitorOptimization] WebView workarounds applied:', webViewInfo.current.workaroundsApplied);
    }
  }, [enableWebViewWorkarounds, inputRef, androidVersion, debugMode]);

  // Performance optimization
  const optimizePerformance = useCallback(() => {
    if (!enablePerformanceOptimization) return;

    // Throttle input events for better performance
    let inputThrottle: NodeJS.Timeout;
    const throttleInput = (callback: () => void) => {
      clearTimeout(inputThrottle);
      inputThrottle = setTimeout(callback, 16); // 60fps
    };

    // Monitor input latency
    const measureInputLatency = () => {
      if (!inputRef.current) return;

      const startTime = performance.now();
      inputRef.current.addEventListener('input', () => {
        performanceMetrics.current.inputLatency = performance.now() - startTime;
      }, { once: true });
    };

    // Apply performance optimizations based on metrics
    const applyOptimizations = () => {
      const now = Date.now();
      if (now - performanceMetrics.current.lastOptimization < 5000) return;

      if (performanceMetrics.current.inputLatency > 32) { // More than 2 frames
        // Reduce visual complexity
        if (inputRef.current) {
          inputRef.current.style.willChange = 'auto';
          inputRef.current.style.transform = 'none';
        }
      }

      performanceMetrics.current.lastOptimization = now;
    };

    const performanceInterval = setInterval(() => {
      measureInputLatency();
      throttleInput(applyOptimizations);
    }, 2000);

    return () => {
      clearInterval(performanceInterval);
      clearTimeout(inputThrottle);
    };
  }, [enablePerformanceOptimization, inputRef]);

  // Memory management
  const setupMemoryManagement = useCallback(() => {
    if (!enableMemoryManagement) return;

    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        performanceMetrics.current.memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;

        if (performanceMetrics.current.memoryUsage > 0.8) {
          // Trigger garbage collection if available
          if ('gc' in window) {
            (window as any).gc();
          }

          // Reduce resource usage
          if (inputRef.current) {
            inputRef.current.style.willChange = 'auto';
          }

          if (debugMode) {
            console.warn('[CapacitorOptimization] High memory usage detected:', performanceMetrics.current.memoryUsage);
          }
        }
      }
    };

    const memoryInterval = setInterval(checkMemory, 10000);

    return () => clearInterval(memoryInterval);
  }, [enableMemoryManagement, inputRef, debugMode]);

  // Initialize all optimizations
  useEffect(() => {
    if (!isNative) return;

    const initializeOptimizations = async () => {
      analyzeWebView();
      
      await Promise.all([
        setupKeyboardPlugin(),
        setupStatusBarAdjustment()
      ]);

      applyWebViewWorkarounds();
      
      const cleanupPerformance = optimizePerformance();
      const cleanupMemory = setupMemoryManagement();

      return () => {
        cleanupPerformance?.();
        cleanupMemory?.();
      };
    };

    let cleanup: (() => void) | undefined;
    initializeOptimizations().then(cleanupFn => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
    };
  }, [
    isNative,
    analyzeWebView,
    setupKeyboardPlugin,
    setupStatusBarAdjustment,
    applyWebViewWorkarounds,
    optimizePerformance,
    setupMemoryManagement
  ]);

  return {
    isCapacitorAndroid: true,
    webViewInfo: webViewInfo.current,
    keyboardInfo: keyboardInfo.current,
    performanceMetrics: performanceMetrics.current,
    platform,
    androidVersion,
    webViewVersion,
    keyboardType
  };
};