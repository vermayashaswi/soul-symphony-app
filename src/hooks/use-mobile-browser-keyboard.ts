import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEnvironmentDetection } from './use-environment-detection';

interface MobileBrowserKeyboardState {
  isVisible: boolean;
  height: number;
  isReady: boolean;
}

/**
 * Mobile browser keyboard handling with Visual Viewport API
 */
export const useMobileBrowserKeyboard = () => {
  const [keyboardState, setKeyboardState] = useState<MobileBrowserKeyboardState>({
    isVisible: false,
    height: 0,
    isReady: false
  });

  const [initialViewportHeight, setInitialViewportHeight] = useState<number>(0);
  const { isMobileBrowser, platform } = useEnvironmentDetection();

  // Platform-specific keyboard height estimates
  const estimatedKeyboardHeight = useMemo(() => {
    if (typeof window === 'undefined') return 300;
    
    if (platform === 'ios') {
      return window.screen.height < 700 ? 260 : 270;
    } else if (platform === 'android') {
      return Math.min(320, window.screen.height * 0.4);
    }
    
    return 300;
  }, [platform]);

  const applyMobileBrowserKeyboardStyles = useCallback((isVisible: boolean, height: number) => {
    const body = document.body;
    const html = document.documentElement;
    
    // Apply mobile browser specific classes
    if (isVisible) {
      body.classList.add('mobile-browser-keyboard-visible');
      html.classList.add('mobile-browser-keyboard-visible');
    } else {
      body.classList.remove('mobile-browser-keyboard-visible');
      html.classList.remove('mobile-browser-keyboard-visible');
    }

    // Set keyboard height for mobile browser
    const keyboardHeightValue = isVisible ? `${height}px` : '0px';
    body.style.setProperty('--mobile-browser-keyboard-height', keyboardHeightValue);
    html.style.setProperty('--mobile-browser-keyboard-height', keyboardHeightValue);

    // Apply Visual Viewport positioning to input containers
    const inputContainers = document.querySelectorAll('.mobile-chat-input-container');
    inputContainers.forEach((container: Element) => {
      const element = container as HTMLElement;
      
      if (isVisible) {
        element.classList.add('mobile-browser-keyboard-visible');
        // Use bottom positioning with keyboard height
        element.style.setProperty('position', 'fixed');
        element.style.setProperty('bottom', `${height}px`);
        element.style.setProperty('transform', 'none');
        element.style.setProperty('transition', 'bottom 0.25s ease-out');
        element.style.setProperty('will-change', 'bottom');
        element.style.setProperty('z-index', '1000');
      } else {
        element.classList.remove('mobile-browser-keyboard-visible');
        // Reset to normal positioning
        element.style.setProperty('bottom', '0px');
        element.style.setProperty('transform', 'translateZ(0)');
        element.style.setProperty('transition', 'bottom 0.2s ease-in');
      }
    });

    // Adjust chat content padding
    const chatContents = document.querySelectorAll('.mobile-chat-content');
    chatContents.forEach((content: Element) => {
      const element = content as HTMLElement;
      
      if (isVisible) {
        element.classList.add('mobile-browser-keyboard-visible');
        const inputHeight = 80; // Approximate input container height
        element.style.setProperty('padding-bottom', `${height + inputHeight + 20}px`);
        element.style.setProperty('transition', 'padding-bottom 0.25s ease-out');
      } else {
        element.classList.remove('mobile-browser-keyboard-visible');
        element.style.removeProperty('padding-bottom');
        element.style.setProperty('transition', 'padding-bottom 0.2s ease-in');
      }
    });

    console.log(`[MobileBrowserKeyboard] Keyboard ${isVisible ? 'shown' : 'hidden'}, height: ${height}px`);
  }, []);

  const detectKeyboardState = useCallback(() => {
    if (!isMobileBrowser || typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv || initialViewportHeight === 0) return;

    const currentHeight = vv.height;
    const heightDiff = initialViewportHeight - currentHeight;
    const threshold = 50;

    let isKeyboardVisible = false;
    let keyboardHeight = 0;

    // Method 1: Visual Viewport height difference
    if (heightDiff > threshold) {
      isKeyboardVisible = true;
      keyboardHeight = heightDiff;
    }

    // Method 2: Viewport ratio detection (backup)
    if (!isKeyboardVisible) {
      const currentRatio = currentHeight / initialViewportHeight;
      if (currentRatio < 0.75) {
        isKeyboardVisible = true;
        keyboardHeight = heightDiff > 0 ? heightDiff : estimatedKeyboardHeight;
      }
    }

    // Method 3: Offset detection (iOS specific)
    if (!isKeyboardVisible && vv.offsetTop > 0) {
      isKeyboardVisible = true;
      keyboardHeight = vv.offsetTop;
    }

    // Method 4: Fallback estimation
    if (!isKeyboardVisible && currentHeight < window.screen.height * 0.6) {
      isKeyboardVisible = true;
      keyboardHeight = estimatedKeyboardHeight;
    }

    const newState = { isVisible: isKeyboardVisible, height: keyboardHeight, isReady: true };
    setKeyboardState(newState);
    applyMobileBrowserKeyboardStyles(isKeyboardVisible, keyboardHeight);

    console.log('[MobileBrowserKeyboard] Detection result:', {
      heightDiff,
      currentHeight,
      initialHeight: initialViewportHeight,
      ...newState
    });
  }, [isMobileBrowser, initialViewportHeight, estimatedKeyboardHeight, applyMobileBrowserKeyboardStyles]);

  useEffect(() => {
    if (!isMobileBrowser) {
      setKeyboardState({ isVisible: false, height: 0, isReady: true });
      return;
    }

    console.log('[MobileBrowserKeyboard] Setting up mobile browser keyboard detection');

    // Initialize viewport height
    const vv = window.visualViewport;
    if (vv) {
      setInitialViewportHeight(vv.height);
    } else {
      setInitialViewportHeight(window.innerHeight);
    }

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[MobileBrowserKeyboard] Input focused, scheduling detection');
        setTimeout(detectKeyboardState, 300);
      }
    };

    const handleFocusOut = () => {
      console.log('[MobileBrowserKeyboard] Input blurred, scheduling detection');
      setTimeout(detectKeyboardState, 100);
    };

    // Set up event listeners
    if (vv) {
      vv.addEventListener('resize', detectKeyboardState);
    }
    
    window.addEventListener('resize', detectKeyboardState);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Initial detection
    setTimeout(() => {
      setKeyboardState(prev => ({ ...prev, isReady: true }));
      detectKeyboardState();
    }, 100);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', detectKeyboardState);
      }
      window.removeEventListener('resize', detectKeyboardState);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isMobileBrowser, detectKeyboardState]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    isReady: keyboardState.isReady
  };
};