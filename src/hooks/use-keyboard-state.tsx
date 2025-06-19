
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
  const { isWebtonative, isAndroid } = useIsMobile();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(0);
  
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isOpen: false,
    height: 0,
    animating: false,
    viewportHeight: window.innerHeight,
    availableHeight: window.visualViewport?.height || window.innerHeight
  });

  const updateKeyboardState = useCallback(() => {
    // Throttle updates to prevent excessive calls
    const now = Date.now();
    if (now - lastUpdateRef.current < 50) {
      return;
    }
    lastUpdateRef.current = now;

    const currentHeight = window.innerHeight;
    const visualHeight = window.visualViewport?.height || currentHeight;
    const keyboardHeight = Math.max(0, currentHeight - visualHeight);
    const isKeyboardOpen = keyboardHeight > 150;
    const availableHeight = visualHeight;
    
    const newState: KeyboardState = {
      isOpen: isKeyboardOpen,
      height: keyboardHeight,
      animating: false,
      viewportHeight: currentHeight,
      availableHeight
    };
    
    setKeyboardState(prevState => {
      // Only update if there's a meaningful change
      if (
        prevState.isOpen !== newState.isOpen ||
        Math.abs(prevState.height - newState.height) > 20 ||
        Math.abs(prevState.availableHeight - newState.availableHeight) > 20
      ) {
        console.log('[KeyboardState] State updated:', newState);
        return newState;
      }
      return prevState;
    });
    
    // Update CSS custom properties
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    document.documentElement.style.setProperty('--available-height', `${availableHeight}px`);
    document.documentElement.style.setProperty('--viewport-height', `${currentHeight}px`);
    
    // Manage body classes
    const body = document.body;
    const html = document.documentElement;
    
    if (isKeyboardOpen) {
      body.classList.add('keyboard-visible');
      html.classList.add('keyboard-open');
      
      if (isWebtonative) {
        body.classList.add('webtonative-keyboard-visible');
      }
    } else {
      body.classList.remove('keyboard-visible', 'webtonative-keyboard-visible');
      html.classList.remove('keyboard-open');
    }
  }, [isWebtonative]);

  useEffect(() => {
    if (!isWebtonative) {
      return;
    }

    console.log('[KeyboardState] Initializing for webtonative');
    updateKeyboardState();

    const debouncedUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(updateKeyboardState, 100);
    };

    const handleResize = () => {
      console.log('[KeyboardState] Resize detected');
      debouncedUpdate();
    };

    const handleVisualViewportChange = () => {
      console.log('[KeyboardState] Visual viewport change');
      debouncedUpdate();
    };

    const handleOrientationChange = () => {
      console.log('[KeyboardState] Orientation change');
      setTimeout(updateKeyboardState, 300);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange, { passive: true });
    }

    // Enhanced Android support
    if (isAndroid) {
      const handleFocusIn = () => {
        console.log('[KeyboardState] Android input focused');
        setIsInputFocused(true);
        setTimeout(updateKeyboardState, 150);
      };

      const handleFocusOut = () => {
        console.log('[KeyboardState] Android input blurred');
        setIsInputFocused(false);
        setTimeout(updateKeyboardState, 150);
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
        }
        
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [isWebtonative, isAndroid, updateKeyboardState]);

  const setInputFocusedWrapper = useCallback((focused: boolean) => {
    setIsInputFocused(focused);
    console.log('[KeyboardState] Input focus changed:', focused);
    setTimeout(updateKeyboardState, 100);
  }, [updateKeyboardState]);

  return {
    keyboardState,
    updateKeyboardState,
    setInputFocused: setInputFocusedWrapper,
    isInputFocused
  };
}
