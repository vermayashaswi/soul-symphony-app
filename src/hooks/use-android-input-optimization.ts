import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface AndroidInputOptions {
  enableIMEOptimization?: boolean;
  enableKeyboardHeightDetection?: boolean;
  optimizeTouchActions?: boolean;
  enableMemoryOptimization?: boolean;
  debugMode?: boolean;
}

export const useAndroidInputOptimization = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: AndroidInputOptions = {}
) => {
  const { platform, androidVersion, webViewVersion, keyboardType, supportsVisualViewport } = useEnhancedPlatformDetection();
  const {
    enableIMEOptimization = true,
    enableKeyboardHeightDetection = true,
    optimizeTouchActions = true,
    enableMemoryOptimization = true,
    debugMode = false
  } = options;

  const keyboardHeight = useRef(0);
  const isKeyboardVisible = useRef(false);
  const originalViewportHeight = useRef(window.innerHeight);
  const inputEventThrottle = useRef<NodeJS.Timeout>();

  // Skip if not Android
  if (platform !== 'android') {
    return { isAndroid: false, keyboardHeight: 0, isKeyboardVisible: false };
  }

  // IME optimization for Android
  const optimizeIME = useCallback(() => {
    if (!enableIMEOptimization || !inputRef.current) return;

    const element = inputRef.current;
    
    // Set IME mode for better text composition
    (element.style as any).imeMode = 'active';
    element.setAttribute('inputmode', 'text');
    
    // Android-specific attributes for better keyboard handling
    element.setAttribute('autocapitalize', 'sentences');
    element.setAttribute('autocorrect', 'on');
    element.setAttribute('spellcheck', 'true');
    
    // Optimize for specific keyboard types
    switch (keyboardType) {
      case 'gboard':
        element.style.webkitAppearance = 'none';
        element.style.appearance = 'none';
        break;
      case 'samsung':
        // Samsung keyboards work better with specific touch actions
        element.style.touchAction = 'manipulation';
        break;
      case 'swype':
        // Swype keyboards need special handling for gestures
        element.style.touchAction = 'none';
        element.style.userSelect = 'text';
        break;
    }

    if (debugMode) {
      console.log('[AndroidInputOptimization] IME optimized for:', keyboardType);
    }
  }, [inputRef, enableIMEOptimization, keyboardType, debugMode]);

  // Keyboard height detection
  const detectKeyboardHeight = useCallback(() => {
    if (!enableKeyboardHeightDetection) return;

    const updateKeyboardHeight = () => {
      const currentHeight = supportsVisualViewport 
        ? window.visualViewport?.height || window.innerHeight
        : window.innerHeight;
      
      const heightDifference = originalViewportHeight.current - currentHeight;
      const wasKeyboardVisible = isKeyboardVisible.current;
      
      // Threshold for keyboard detection (150px to avoid false positives)
      isKeyboardVisible.current = heightDifference > 150;
      keyboardHeight.current = isKeyboardVisible.current ? heightDifference : 0;

      // Update CSS custom properties for layout adjustments
      document.documentElement.style.setProperty(
        '--keyboard-height', 
        `${keyboardHeight.current}px`
      );
      document.documentElement.style.setProperty(
        '--keyboard-visible', 
        isKeyboardVisible.current ? '1' : '0'
      );

      // Dispatch events for keyboard state changes
      if (wasKeyboardVisible !== isKeyboardVisible.current) {
        window.dispatchEvent(new CustomEvent(
          isKeyboardVisible.current ? 'androidKeyboardShow' : 'androidKeyboardHide',
          { detail: { height: keyboardHeight.current } }
        ));

        if (debugMode) {
          console.log(`[AndroidInputOptimization] Keyboard ${isKeyboardVisible.current ? 'shown' : 'hidden'}:`, 
                     keyboardHeight.current);
        }
      }
    };

    if (supportsVisualViewport && window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateKeyboardHeight);
      return () => window.visualViewport?.removeEventListener('resize', updateKeyboardHeight);
    } else {
      window.addEventListener('resize', updateKeyboardHeight);
      return () => window.removeEventListener('resize', updateKeyboardHeight);
    }
  }, [enableKeyboardHeightDetection, supportsVisualViewport, debugMode]);

  // Touch action optimization
  const optimizeTouchAction = useCallback(() => {
    if (!optimizeTouchActions || !inputRef.current) return;

    const element = inputRef.current;

    // Set appropriate touch actions based on Android version and keyboard
    if (androidVersion && parseFloat(androidVersion) >= 7.0) {
      // Modern Android versions handle touch better
      element.style.touchAction = 'manipulation';
    } else {
      // Older Android versions need more specific handling
      element.style.touchAction = 'none';
    }

    // Prevent double-tap zoom on input
    element.style.userSelect = 'text';
    element.style.webkitUserSelect = 'text';
    (element.style as any).webkitTouchCallout = 'none';

    // Optimize scrolling behavior
    element.style.overscrollBehavior = 'contain';
    (element.style as any).webkitOverflowScrolling = 'touch';

    if (debugMode) {
      console.log('[AndroidInputOptimization] Touch actions optimized for Android', androidVersion);
    }
  }, [inputRef, optimizeTouchActions, androidVersion, debugMode]);

  // Memory optimization for Android WebView
  const setupMemoryOptimization = useCallback(() => {
    if (!enableMemoryOptimization) return;

    let memoryCheckInterval: NodeJS.Timeout;

    // Check memory usage periodically
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;

        if (memoryUsage > 0.85) {
          // High memory usage - optimize
          if (debugMode) {
            console.warn('[AndroidInputOptimization] High memory usage detected:', memoryUsage);
          }

          // Throttle input events more aggressively
          if (inputRef.current) {
            inputRef.current.style.willChange = 'auto';
          }

          // Trigger garbage collection if available
          if ('gc' in window) {
            (window as any).gc();
          }
        }
      }
    };

    memoryCheckInterval = setInterval(checkMemory, 10000); // Check every 10 seconds

    return () => {
      if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
      }
    };
  }, [enableMemoryOptimization, inputRef, debugMode]);

  // Throttled input event handler for performance
  const handleInputWithThrottle = useCallback((e: Event) => {
    if (inputEventThrottle.current) {
      clearTimeout(inputEventThrottle.current);
    }

    inputEventThrottle.current = setTimeout(() => {
      // Process the input event after throttle
      if (debugMode) {
        console.log('[AndroidInputOptimization] Input processed after throttle');
      }
    }, 16); // ~60fps throttling
  }, [debugMode]);

  // Setup optimizations
  useEffect(() => {
    if (platform !== 'android' || !inputRef.current) return;

    optimizeIME();
    optimizeTouchAction();
    
    const cleanupKeyboardDetection = detectKeyboardHeight();
    const cleanupMemoryOptimization = setupMemoryOptimization();

    // Add throttled input listener
    const element = inputRef.current;
    element.addEventListener('input', handleInputWithThrottle);

    return () => {
      element.removeEventListener('input', handleInputWithThrottle);
      
      if (cleanupKeyboardDetection) {
        cleanupKeyboardDetection();
      }
      if (cleanupMemoryOptimization) {
        cleanupMemoryOptimization();
      }
      
      if (inputEventThrottle.current) {
        clearTimeout(inputEventThrottle.current);
      }
    };
  }, [
    platform,
    inputRef,
    optimizeIME,
    optimizeTouchAction,
    detectKeyboardHeight,
    setupMemoryOptimization,
    handleInputWithThrottle
  ]);

  return {
    isAndroid: true,
    keyboardHeight: keyboardHeight.current,
    isKeyboardVisible: isKeyboardVisible.current,
    androidVersion,
    webViewVersion,
    keyboardType
  };
};