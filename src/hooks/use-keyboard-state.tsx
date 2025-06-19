
import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsMobile } from './use-mobile';

interface KeyboardState {
  isOpen: boolean;
  height: number;
  animating: boolean;
  viewportHeight: number;
  availableHeight: number;
}

interface KeyboardStateHook {
  keyboardState: KeyboardState;
  updateKeyboardState: () => void;
  setInputFocused: (focused: boolean) => void;
  isInputFocused: boolean;
}

export function useKeyboardState(): KeyboardStateHook {
  const { isWebtonative, isAndroid, isIOS } = useIsMobile();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const animationFrameRef = useRef<number>();
  const lastHeightRef = useRef<number>(window.innerHeight);
  
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isOpen: false,
    height: 0,
    animating: false,
    viewportHeight: window.innerHeight,
    availableHeight: window.visualViewport?.height || window.innerHeight
  });

  const updateKeyboardState = useCallback(() => {
    const currentHeight = window.innerHeight;
    const visualHeight = window.visualViewport?.height || currentHeight;
    const keyboardHeight = Math.max(0, currentHeight - visualHeight);
    const isKeyboardOpen = keyboardHeight > 100; // More conservative threshold
    
    // Detect animation state
    const heightChanged = Math.abs(lastHeightRef.current - visualHeight) > 10;
    lastHeightRef.current = visualHeight;
    
    const newState: KeyboardState = {
      isOpen: isKeyboardOpen,
      height: keyboardHeight,
      animating: heightChanged,
      viewportHeight: currentHeight,
      availableHeight: visualHeight
    };
    
    setKeyboardState(prevState => {
      // Only update if there's a significant change
      if (
        prevState.isOpen !== newState.isOpen ||
        Math.abs(prevState.height - newState.height) > 10 ||
        Math.abs(prevState.availableHeight - newState.availableHeight) > 10
      ) {
        return newState;
      }
      return prevState;
    });
    
    // Update CSS custom properties
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    document.documentElement.style.setProperty('--available-height', `${visualHeight}px`);
    document.documentElement.style.setProperty('--viewport-height', `${currentHeight}px`);
    
    // Manage body classes for keyboard state
    const body = document.body;
    const html = document.documentElement;
    
    if (isKeyboardOpen) {
      body.classList.add('keyboard-visible');
      html.classList.add('keyboard-open');
      
      // Add webtonative-specific classes
      if (isWebtonative) {
        body.classList.add('webtonative-keyboard-visible');
        html.classList.add('webtonative-keyboard-open');
      }
      
      // Add platform-specific classes
      if (isAndroid) {
        body.classList.add('android-keyboard-visible');
      }
      if (isIOS) {
        body.classList.add('ios-keyboard-visible');
      }
    } else {
      body.classList.remove('keyboard-visible', 'webtonative-keyboard-visible', 'android-keyboard-visible', 'ios-keyboard-visible');
      html.classList.remove('keyboard-open', 'webtonative-keyboard-open');
    }
    
    console.log('[KeyboardState] Updated:', {
      isOpen: isKeyboardOpen,
      height: keyboardHeight,
      available: visualHeight,
      viewport: currentHeight,
      isWebtonative,
      isAndroid,
      isIOS
    });
  }, [isWebtonative, isAndroid, isIOS]);

  useEffect(() => {
    if (!isWebtonative) {
      return;
    }

    console.log('[KeyboardState] Setting up keyboard detection for webtonative');

    // Initial state
    updateKeyboardState();

    // Set up event listeners
    const handleResize = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateKeyboardState);
    };

    const handleVisualViewportChange = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateKeyboardState);
    };

    const handleOrientationChange = () => {
      console.log('[KeyboardState] Orientation change detected');
      setTimeout(() => {
        updateKeyboardState();
      }, 300);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange, { passive: true });
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange, { passive: true });
    }

    // Enhanced Android-specific handling
    if (isAndroid) {
      const handleFocusIn = () => {
        console.log('[KeyboardState] Input focused - Android');
        setIsInputFocused(true);
        setTimeout(updateKeyboardState, 100);
      };

      const handleFocusOut = () => {
        console.log('[KeyboardState] Input blurred - Android');
        setIsInputFocused(false);
        setTimeout(updateKeyboardState, 100);
      };

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleOrientationChange);
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
        
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
          window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }

    // Cleanup for non-Android devices
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isWebtonative, isAndroid, updateKeyboardState]);

  const setInputFocusedWrapper = useCallback((focused: boolean) => {
    setIsInputFocused(focused);
    console.log('[KeyboardState] Input focus changed:', focused);
    
    // Trigger keyboard state update on focus change
    setTimeout(updateKeyboardState, 50);
  }, [updateKeyboardState]);

  return {
    keyboardState,
    updateKeyboardState,
    setInputFocused: setInputFocusedWrapper,
    isInputFocused
  };
}
