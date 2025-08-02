import { useEffect } from 'react';
import { usePlatformDetection } from './use-platform-detection';
import { useUnifiedTouchActionManager } from './use-unified-touch-action-manager';

/**
 * Enhanced hook to optimize native keyboard functionality on mobile platforms
 * Now integrates with unified touch action management for better coordination
 * Ensures proper touch event handling and prevents interference with
 * native keyboard gestures like swipe-to-type and word prediction
 */
export const useNativeKeyboard = () => {
  const { platform, isNative, isReady } = usePlatformDetection();
  const touchActionManager = useUnifiedTouchActionManager({
    debugMode: false,
    respectCapacitorNative: isNative
  });

  useEffect(() => {
    if (!isReady || !isNative) return;

    // Set up platform-specific keyboard optimizations using unified touch action manager
    const optimizeKeyboardHandling = () => {
      // Use unified touch action management instead of direct manipulation
      touchActionManager.setTouchAction(document.body, 'general', 'manipulation', 'native-keyboard-body');
      
      // Add platform-specific classes for debugging
      document.body.classList.add(`keyboard-optimized-${platform}`);
      
      // iOS-specific optimizations
      if (platform === 'ios') {
        // Prevent zoom on input focus
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          const content = viewport.getAttribute('content');
          if (content && !content.includes('user-scalable=no')) {
            viewport.setAttribute('content', content + ', user-scalable=no');
          }
        }
        
        // Optimize scroll behavior for iOS keyboard
        document.documentElement.style.setProperty('--ios-keyboard-optimization', '1');
      }
      
      // Android-specific optimizations
      if (platform === 'android') {
        // Ensure proper window resizing behavior
        document.documentElement.style.setProperty('--android-keyboard-optimization', '1');
        
        // Optimize touch handling for Android keyboards
        (document.body.style as any).webkitTouchCallout = 'none';
        (document.body.style as any).webkitUserSelect = 'none';
      }

      console.log(`[NativeKeyboard] Optimizations applied for ${platform}`);
    };

    // Apply optimizations with a delay to ensure DOM is ready
    const timeoutId = setTimeout(optimizeKeyboardHandling, 100);

    return () => {
      clearTimeout(timeoutId);
      
      // Clean up optimizations using unified touch action manager
      touchActionManager.removeTouchAction('native-keyboard-body');
      document.body.classList.remove(`keyboard-optimized-${platform}`);
      document.documentElement.style.removeProperty('--ios-keyboard-optimization');
      document.documentElement.style.removeProperty('--android-keyboard-optimization');
    };
  }, [platform, isNative, isReady, touchActionManager]);

  return {
    platform,
    isNative,
    isReady,
    isOptimized: isReady && isNative
  };
};