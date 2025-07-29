
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
    let measurementAttempts = 0;
    
    const getMeasurements = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.clientHeight;
      const viewportHeight = window.visualViewport?.height || windowHeight;
      const screenHeight = window.screen?.height || windowHeight;
      
      return {
        windowHeight,
        documentHeight,
        viewportHeight,
        screenHeight,
        heightDifference: windowHeight - viewportHeight,
        documentDifference: documentHeight - viewportHeight
      };
    };
    
    const handleKeyboardDetection = () => {
      if (isDetecting) return;
      isDetecting = true;
      measurementAttempts++;
      
      if (detectionTimeout) clearTimeout(detectionTimeout);
      
      detectionTimeout = setTimeout(() => {
        try {
          const measurements = getMeasurements();
          const { windowHeight, viewportHeight, heightDifference } = measurements;
          
          // Improved platform-specific thresholds and logic
          let threshold: number;
          let keyboardHeight: number;
          let keyboardVisible: boolean;
          
          if (platform === 'android') {
            // Android: More aggressive detection, account for status bar
            threshold = 100;
            keyboardHeight = heightDifference;
            keyboardVisible = heightDifference > threshold;
          } else if (platform === 'ios') {
            // iOS: Account for safe areas and home indicator
            threshold = 80;
            keyboardHeight = heightDifference;
            keyboardVisible = heightDifference > threshold;
          } else {
            // Web fallback
            threshold = 120;
            keyboardHeight = heightDifference;
            keyboardVisible = heightDifference > threshold;
          }
          
          // Ensure keyboard height is never negative and add small buffer
          const finalKeyboardHeight = keyboardVisible ? Math.max(keyboardHeight - 2, 0) : 0;
          
          console.log('[KeyboardDetection] Enhanced detection:', {
            platform,
            measurements,
            threshold,
            keyboardVisible,
            finalKeyboardHeight,
            attempt: measurementAttempts
          });
          
          updateKeyboardState(keyboardVisible, finalKeyboardHeight);
          
          // Set CSS variables with precise measurements
          document.documentElement.style.setProperty('--keyboard-height', `${finalKeyboardHeight}px`);
          document.documentElement.style.setProperty('--safe-keyboard-height', `${keyboardVisible ? Math.max(finalKeyboardHeight, 280) : 0}px`);
          
          // Add body classes for additional styling hooks
          document.body.classList.toggle('keyboard-visible', keyboardVisible);
          document.body.classList.toggle(`keyboard-${platform}`, keyboardVisible);
          
        } catch (error) {
          console.error('[KeyboardDetection] Error during detection:', error);
        } finally {
          isDetecting = false;
        }
      }, 30); // Reduced timeout for faster response
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
