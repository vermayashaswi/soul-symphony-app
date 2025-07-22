
import { useEffect } from 'react';
import { usePlatformDetection } from './use-platform-detection';
import { useKeyboardState } from './use-keyboard-state';

export const useKeyboardDetection = () => {
  const { platform, isNative, isReady } = usePlatformDetection();
  const { keyboardState, updateKeyboardState } = useKeyboardState();

  useEffect(() => {
    if (!isReady) return;

    let detectionTimeout: NodeJS.Timeout;
    let lastViewportHeight = window.innerHeight;
    let isDetecting = false;
    let stabilityTimeout: NodeJS.Timeout;
    
    const handleKeyboardDetection = () => {
      if (isDetecting) {
        console.log('[KeyboardDetection] Detection already in progress, skipping');
        return;
      }
      isDetecting = true;
      
      if (detectionTimeout) clearTimeout(detectionTimeout);
      
      detectionTimeout = setTimeout(() => {
        try {
          let keyboardVisible = false;
          let keyboardHeight = 0;
          
          if (window.visualViewport) {
            // Use Visual Viewport API (preferred method)
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            const heightDifference = windowHeight - viewportHeight;
            
            // Platform-specific thresholds with better detection
            const threshold = platform === 'android' ? 120 : platform === 'ios' ? 80 : 100;
            keyboardVisible = heightDifference > threshold;
            keyboardHeight = keyboardVisible ? heightDifference : 0;
            
            console.log('[KeyboardDetection] Visual viewport check:', {
              windowHeight,
              viewportHeight,
              heightDifference,
              threshold,
              keyboardVisible,
              platform,
              timestamp: new Date().toISOString()
            });
          } else {
            // Fallback detection using window resize with improved logic
            const currentHeight = window.innerHeight;
            const heightDifference = lastViewportHeight - currentHeight;
            
            // More conservative thresholds for fallback with hysteresis
            const showThreshold = platform === 'android' ? 150 : 120;
            const hideThreshold = platform === 'android' ? -30 : -20;
            
            if (heightDifference > showThreshold) {
              keyboardVisible = true;
              keyboardHeight = heightDifference;
            } else if (heightDifference < hideThreshold) {
              keyboardVisible = false;
              keyboardHeight = 0;
            } else {
              // Use current state for stability in ambiguous cases
              keyboardVisible = keyboardState.isVisible;
              keyboardHeight = keyboardState.height;
            }
            
            console.log('[KeyboardDetection] Fallback detection:', {
              lastHeight: lastViewportHeight,
              currentHeight,
              heightDifference,
              showThreshold,
              hideThreshold,
              keyboardVisible,
              platform
            });
          }
          
          // Only update if there's a significant change to prevent flicker
          const significantChange = Math.abs(keyboardHeight - keyboardState.height) > 10 || 
                                  keyboardVisible !== keyboardState.isVisible;
          
          if (significantChange) {
            // Add stability delay for keyboard state changes
            if (stabilityTimeout) clearTimeout(stabilityTimeout);
            
            stabilityTimeout = setTimeout(() => {
              updateKeyboardState(keyboardVisible, keyboardHeight);
            }, keyboardVisible ? 50 : 100); // Faster show, slower hide for better UX
          }
          
        } catch (error) {
          console.error('[KeyboardDetection] Error during detection:', error);
        } finally {
          isDetecting = false;
        }
      }, 30); // Reduced timeout for more responsive detection
    };

    // Store initial height
    lastViewportHeight = window.innerHeight;

    // Visual viewport listeners (preferred)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleKeyboardDetection);
      console.log('[KeyboardDetection] Using Visual Viewport API');
    } else {
      console.log('[KeyboardDetection] Visual Viewport API not available, using fallback');
    }
    
    // Fallback listeners
    window.addEventListener('resize', handleKeyboardDetection);
    
    // Handle orientation changes with delay
    const handleOrientationChange = () => {
      console.log('[KeyboardDetection] Orientation change detected');
      setTimeout(() => {
        lastViewportHeight = window.innerHeight;
        updateKeyboardState(false, 0); // Reset keyboard state on orientation change
        setTimeout(handleKeyboardDetection, 100);
      }, 500);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Enhanced input focus/blur detection
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const inputType = target.tagName === 'INPUT' ? (target as HTMLInputElement).type : 'textarea';
        console.log('[KeyboardDetection] Input focused:', target.tagName, inputType);
        // More aggressive detection on focus for mobile devices
        setTimeout(handleKeyboardDetection, platform === 'ios' ? 300 : 200);
      }
    };
    
    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[KeyboardDetection] Input blurred:', target.tagName);
        // Delayed check on blur to handle rapid focus changes
        setTimeout(handleKeyboardDetection, 150);
      }
    };
    
    document.addEventListener('focusin', handleFocus, { passive: true });
    document.addEventListener('focusout', handleBlur, { passive: true });

    // Initial check with delay to ensure DOM is ready
    setTimeout(handleKeyboardDetection, 100);

    return () => {
      if (detectionTimeout) clearTimeout(detectionTimeout);
      if (stabilityTimeout) clearTimeout(stabilityTimeout);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      }
      window.removeEventListener('resize', handleKeyboardDetection);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      
      // Clean up CSS and attributes
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.removeAttribute('data-keyboard-visible');
      document.documentElement.removeAttribute('data-keyboard-height');
      
      console.log('[KeyboardDetection] Cleanup completed');
    };
  }, [updateKeyboardState, platform, isReady, keyboardState.isVisible, keyboardState.height]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    previousKeyboardHeight: keyboardState.previousHeight,
    platform,
    isNative,
    isReady
  };
};
