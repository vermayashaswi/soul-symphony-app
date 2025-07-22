
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
    
    const handleKeyboardDetection = () => {
      if (isDetecting) return;
      isDetecting = true;
      
      if (detectionTimeout) clearTimeout(detectionTimeout);
      
      detectionTimeout = setTimeout(() => {
        try {
          if (window.visualViewport) {
            // Use Visual Viewport API (preferred method)
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            const heightDifference = windowHeight - viewportHeight;
            
            // Platform-specific thresholds
            const threshold = platform === 'android' ? 150 : platform === 'ios' ? 100 : 120;
            const keyboardVisible = heightDifference > threshold;
            
            console.log('[KeyboardDetection] Visual viewport check:', {
              windowHeight,
              viewportHeight,
              heightDifference,
              threshold,
              keyboardVisible,
              platform
            });
            
            updateKeyboardState(keyboardVisible, keyboardVisible ? heightDifference : 0);
          } else {
            // Fallback detection using window resize
            const currentHeight = window.innerHeight;
            const heightDifference = lastViewportHeight - currentHeight;
            
            // More conservative thresholds for fallback
            const showThreshold = platform === 'android' ? 200 : 150;
            const hideThreshold = -50;
            
            if (heightDifference > showThreshold) {
              updateKeyboardState(true, heightDifference);
            } else if (heightDifference < hideThreshold) {
              updateKeyboardState(false, 0);
            }
            
            console.log('[KeyboardDetection] Fallback detection:', {
              lastHeight: lastViewportHeight,
              currentHeight,
              heightDifference,
              keyboardVisible: heightDifference > showThreshold
            });
          }
        } catch (error) {
          console.error('[KeyboardDetection] Error during detection:', error);
        } finally {
          isDetecting = false;
        }
      }, 50);
    };

    // Store initial height
    lastViewportHeight = window.innerHeight;

    // Visual viewport listeners (preferred)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleKeyboardDetection);
    }
    
    // Fallback listeners
    window.addEventListener('resize', handleKeyboardDetection);
    
    // Handle orientation changes with delay
    const handleOrientationChange = () => {
      setTimeout(() => {
        lastViewportHeight = window.innerHeight;
        handleKeyboardDetection();
      }, 500);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Input focus/blur detection for additional reliability
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[KeyboardDetection] Input focused, checking keyboard state');
        setTimeout(handleKeyboardDetection, 300);
      }
    };
    
    const handleBlur = () => {
      console.log('[KeyboardDetection] Input blurred, checking keyboard state');
      setTimeout(handleKeyboardDetection, 100);
    };
    
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    // Initial check
    handleKeyboardDetection();

    return () => {
      if (detectionTimeout) clearTimeout(detectionTimeout);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      }
      window.removeEventListener('resize', handleKeyboardDetection);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      
      // Clean up CSS
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--keyboard-height');
    };
  }, [updateKeyboardState, platform, isReady]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    previousKeyboardHeight: keyboardState.previousHeight,
    platform,
    isNative,
    isReady
  };
};
