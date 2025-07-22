
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
    document.body.classList.toggle(`platform-${platform}`, true);
    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    
    // Also update mobile navigation if it exists
    const mobileNav = document.querySelector('.mobile-navigation');
    if (mobileNav) {
      mobileNav.classList.toggle('keyboard-visible', isVisible);
    }
    
    // Update mobile chat interface
    const mobileChatInterface = document.querySelector('.mobile-chat-interface');
    if (mobileChatInterface) {
      mobileChatInterface.classList.toggle('keyboard-visible', isVisible);
    }
    
    // Dispatch custom events for other components
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, platform, isNative } 
    }));
  }, [platform, isNative]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let resizeTimeoutId: NodeJS.Timeout;
    
    const handleKeyboardDetection = () => {
      // Clear previous timeout to debounce rapid changes
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height;
          const windowHeight = window.innerHeight;
          const heightDifference = windowHeight - viewportHeight;
          
          // More reliable threshold - accounts for browser UI changes
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
          
          // For fallback, use a more conservative approach
          if (isInputFocused) {
            // Delay to allow keyboard to appear
            setTimeout(() => {
              const newHeight = window.innerHeight;
              const originalHeight = screen.height;
              const heightDiff = originalHeight - newHeight;
              const isKeyboardOpen = heightDiff > 150;
              
              updateKeyboardState(isKeyboardOpen, isKeyboardOpen ? heightDiff : 0);
            }, 300);
          } else {
            updateKeyboardState(false, 0);
          }
        }
      }, 50); // Small debounce
    };

    // Initial check
    handleKeyboardDetection();

    // Visual viewport listeners (preferred)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleKeyboardDetection);
    }
    
    // Fallback listeners with debouncing
    const handleResize = () => {
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(handleKeyboardDetection, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Input focus/blur listeners for additional detection
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[KeyboardDetection] Input focused');
        setTimeout(handleKeyboardDetection, 100);
      }
    };
    
    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[KeyboardDetection] Input blurred');
        setTimeout(handleKeyboardDetection, 100);
      }
    };
    
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      
      // Clean up CSS
      document.body.classList.remove('keyboard-visible', `platform-${platform}`);
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
