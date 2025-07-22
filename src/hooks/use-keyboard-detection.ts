
import { useState, useEffect, useCallback } from 'react';

interface KeyboardState {
  isVisible: boolean;
  height: number;
  previousHeight: number;
}

export const useKeyboardDetection = () => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    previousHeight: 0
  });

  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'web'>('web');
  const [isReady, setIsReady] = useState(false);

  // Platform detection - run once on mount
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const nativeApp = window.location.href.includes('capacitor://') || 
                     window.location.href.includes('ionic://') ||
                     (window as any).Capacitor?.isNative;

    setIsNative(nativeApp);
    setPlatform(isAndroid ? 'android' : isIOS ? 'ios' : 'web');
    
    // Set platform classes immediately
    document.body.classList.toggle('platform-android', isAndroid);
    document.body.classList.toggle('platform-ios', isIOS);
    document.body.classList.toggle('platform-native', nativeApp);
    
    console.log('[KeyboardDetection] Platform detected:', { isAndroid, isIOS, nativeApp });
    setIsReady(true);
  }, []);

  const updateKeyboardState = useCallback((isVisible: boolean, height: number = 0) => {
    setKeyboardState(prev => {
      if (prev.isVisible === isVisible && prev.height === height) {
        return prev;
      }
      
      console.log('[KeyboardDetection] State change:', { 
        from: { visible: prev.isVisible, height: prev.height },
        to: { visible: isVisible, height }
      });
      
      return {
        isVisible,
        height,
        previousHeight: prev.height
      };
    });

    // Update CSS classes and variables
    document.body.classList.toggle('keyboard-visible', isVisible);
    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    
    // Update specific components with class toggles
    const elementsToUpdate = [
      '.mobile-navigation',
      '.mobile-chat-interface',
      '.mobile-chat-input-container',
      '.mobile-chat-content'
    ];
    
    elementsToUpdate.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.classList.toggle('keyboard-visible', isVisible);
      }
    });
    
    // Dispatch custom events for components that need to react
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, platform, isNative } 
    }));
  }, [platform, isNative]);

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
