
import { useEffect } from 'react';
import { usePlatformDetection } from './use-platform-detection';
import { useKeyboardState } from './use-keyboard-state';

export const useKeyboardDetection = () => {
  const { platform, isNative, isReady } = usePlatformDetection();
  const { keyboardState, updateKeyboardState } = useKeyboardState();

  useEffect(() => {
    if (!isReady) return;

    let detectionTimeout: NodeJS.Timeout;
    let isDetecting = false;
    
    const detectKeyboard = () => {
      if (isDetecting) return;
      isDetecting = true;
      
      if (detectionTimeout) clearTimeout(detectionTimeout);
      
      detectionTimeout = setTimeout(() => {
        try {
          const windowHeight = window.innerHeight;
          const viewportHeight = window.visualViewport?.height || windowHeight;
          const heightDiff = windowHeight - viewportHeight;
          
          // Simplified threshold detection
          const threshold = platform === 'ios' ? 60 : 80;
          const isVisible = heightDiff > threshold;
          const keyboardHeight = isVisible ? heightDiff : 0;
          
          console.log('[KeyboardDetection] Simple detection:', {
            platform,
            windowHeight,
            viewportHeight,
            heightDiff,
            isVisible,
            keyboardHeight
          });
          
          updateKeyboardState(isVisible, keyboardHeight);
          
          // Direct DOM manipulation for input positioning
          const chatInput = document.querySelector('.mobile-chat-input-container');
          if (chatInput) {
            if (isVisible) {
              const translateY = -keyboardHeight;
              (chatInput as HTMLElement).style.transform = `translateY(${translateY}px)`;
              (chatInput as HTMLElement).style.transition = 'transform 0.2s ease-out';
            } else {
              (chatInput as HTMLElement).style.transform = 'translateY(0px)';
              (chatInput as HTMLElement).style.transition = 'transform 0.2s ease-out';
            }
          }
          
          // Set CSS variables for additional styling
          document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
          
          // Toggle body classes
          document.body.classList.toggle('keyboard-visible', isVisible);
          document.body.classList.toggle(`keyboard-${platform}`, isVisible);
          
          // Dispatch custom events for components that need to react
          window.dispatchEvent(new CustomEvent('keyboardPositionUpdate', {
            detail: { isVisible, keyboardHeight, translateY: isVisible ? -keyboardHeight : 0 }
          }));
          
        } catch (error) {
          console.error('[KeyboardDetection] Error:', error);
        } finally {
          isDetecting = false;
        }
      }, 10); // Faster response
    };

    // Visual viewport listeners (preferred)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboard);
    }
    
    // Fallback listeners
    window.addEventListener('resize', detectKeyboard);
    
    // Handle orientation changes with delay
    const handleOrientationChange = () => {
      setTimeout(detectKeyboard, 500);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Input focus/blur detection for additional reliability
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[KeyboardDetection] Input focused');
        setTimeout(detectKeyboard, 250);
      }
    };
    
    const handleBlur = () => {
      console.log('[KeyboardDetection] Input blurred');
      setTimeout(detectKeyboard, 100);
    };
    
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    // Initial check
    detectKeyboard();

    return () => {
      if (detectionTimeout) clearTimeout(detectionTimeout);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', detectKeyboard);
      }
      window.removeEventListener('resize', detectKeyboard);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      
      // Clean up DOM manipulation
      const chatInput = document.querySelector('.mobile-chat-input-container');
      if (chatInput) {
        (chatInput as HTMLElement).style.transform = '';
        (chatInput as HTMLElement).style.transition = '';
      }
      
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
