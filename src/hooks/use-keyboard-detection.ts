
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

  // Platform detection
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const nativeApp = window.location.href.includes('capacitor://') || 
                     window.location.href.includes('ionic://') ||
                     (window as any).Capacitor?.isNative;

    setIsNative(nativeApp);
    setPlatform(isAndroid ? 'android' : isIOS ? 'ios' : 'web');
    
    console.log('[KeyboardDetection] Platform detected:', { isAndroid, isIOS, nativeApp });
  }, []);

  const updateKeyboardState = useCallback((isVisible: boolean, height: number = 0) => {
    setKeyboardState(prev => {
      if (prev.isVisible === isVisible && prev.height === height) {
        return prev; // No change
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

    // Update CSS classes for styling
    document.body.classList.toggle('keyboard-visible', isVisible);
    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    
    // Dispatch custom events for other components
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, platform, isNative } 
    }));
  }, [platform, isNative]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleKeyboardDetection = () => {
      // Clear previous timeout to debounce rapid changes
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height;
          const windowHeight = window.innerHeight;
          const heightDifference = windowHeight - viewportHeight;
          
          // More reliable threshold - accounts for browser UI changes
          const threshold = platform === 'android' ? 150 : 100;
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
          // Fallback for browsers without visual viewport API
          const focusedElement = document.activeElement;
          const isInputFocused = focusedElement && (
            focusedElement.tagName === 'INPUT' || 
            focusedElement.tagName === 'TEXTAREA' ||
            focusedElement.getAttribute('contenteditable') === 'true'
          );
          
          console.log('[KeyboardDetection] Fallback detection:', {
            isInputFocused,
            activeElement: focusedElement?.tagName
          });
          
          updateKeyboardState(!!isInputFocused, isInputFocused ? 300 : 0);
        }
      }, 50); // Small debounce
    };

    // Initial check
    handleKeyboardDetection();

    // Visual viewport listeners (preferred)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleKeyboardDetection);
    }
    
    // Fallback listeners
    window.addEventListener('resize', handleKeyboardDetection);
    
    // Input focus/blur listeners for additional detection
    const handleFocus = () => {
      console.log('[KeyboardDetection] Input focused');
      setTimeout(handleKeyboardDetection, 100);
    };
    
    const handleBlur = () => {
      console.log('[KeyboardDetection] Input blurred');
      setTimeout(handleKeyboardDetection, 100);
    };
    
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      }
      window.removeEventListener('resize', handleKeyboardDetection);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      
      // Clean up CSS
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--keyboard-height');
    };
  }, [updateKeyboardState, platform]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    previousKeyboardHeight: keyboardState.previousHeight,
    platform,
    isNative
  };
};
