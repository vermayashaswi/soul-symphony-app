
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
    
    // Set platform classes immediately
    document.body.classList.toggle('platform-android', isAndroid);
    document.body.classList.toggle('platform-ios', isIOS);
    document.body.classList.toggle('platform-native', nativeApp);
    
    console.log('[KeyboardDetection] Platform detected:', { isAndroid, isIOS, nativeApp });
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
    
    // Update components
    const mobileNav = document.querySelector('.mobile-navigation');
    if (mobileNav) {
      mobileNav.classList.toggle('keyboard-visible', isVisible);
    }
    
    const mobileChatInterface = document.querySelector('.mobile-chat-interface');
    if (mobileChatInterface) {
      mobileChatInterface.classList.toggle('keyboard-visible', isVisible);
    }
    
    const chatInputContainer = document.querySelector('.mobile-chat-input-container');
    if (chatInputContainer) {
      chatInputContainer.classList.toggle('keyboard-visible', isVisible);
    }
    
    // Dispatch events
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, platform, isNative } 
    }));
  }, [platform, isNative]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let lastViewportHeight = window.innerHeight;
    
    const handleKeyboardDetection = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height;
          const windowHeight = window.innerHeight;
          const heightDifference = windowHeight - viewportHeight;
          
          // Improved threshold based on platform
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
          
          if (heightDifference > 150) {
            updateKeyboardState(true, heightDifference);
          } else if (heightDifference < -50) {
            updateKeyboardState(false, 0);
          }
          
          console.log('[KeyboardDetection] Fallback detection:', {
            lastHeight: lastViewportHeight,
            currentHeight,
            heightDifference,
            keyboardVisible: heightDifference > 150
          });
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
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        lastViewportHeight = window.innerHeight;
        handleKeyboardDetection();
      }, 500);
    });
    
    // Input focus/blur detection
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[KeyboardDetection] Input focused');
        setTimeout(handleKeyboardDetection, 300);
      }
    };
    
    const handleBlur = () => {
      console.log('[KeyboardDetection] Input blurred');
      setTimeout(handleKeyboardDetection, 100);
    };
    
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    // Initial check
    handleKeyboardDetection();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      }
      window.removeEventListener('resize', handleKeyboardDetection);
      window.removeEventListener('orientationchange', handleKeyboardDetection);
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
