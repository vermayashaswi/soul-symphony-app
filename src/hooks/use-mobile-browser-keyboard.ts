
import { useState, useEffect, useCallback, useRef } from 'react';
import { useEnvironmentDetection } from './use-environment-detection';

interface MobileBrowserKeyboardState {
  isVisible: boolean;
  height: number;
  isReady: boolean;
}

/**
 * Enhanced mobile browser keyboard handling with Visual Viewport API
 */
export const useMobileBrowserKeyboard = () => {
  const [keyboardState, setKeyboardState] = useState<MobileBrowserKeyboardState>({
    isVisible: false,
    height: 0,
    isReady: false
  });

  const [initialViewportHeight, setInitialViewportHeight] = useState<number>(0);
  const { isMobileBrowser, platform, hasVisualViewport } = useEnvironmentDetection();
  const isProcessingRef = useRef(false);

  // Apply CSS variables and classes for mobile browser keyboard
  const applyCSSVariables = useCallback((isVisible: boolean, height: number) => {
    const root = document.documentElement;
    const body = document.body;
    
    // Set CSS custom properties
    const keyboardHeightValue = isVisible ? `${height}px` : '0px';
    root.style.setProperty('--keyboard-height', keyboardHeightValue);
    root.style.setProperty('--mobile-browser-keyboard-height', keyboardHeightValue);
    
    // Apply classes to body and root
    if (isVisible) {
      body.classList.add('mobile-browser-keyboard-visible');
      root.classList.add('mobile-browser-keyboard-visible');
    } else {
      body.classList.remove('mobile-browser-keyboard-visible');
      root.classList.remove('mobile-browser-keyboard-visible');
    }

    console.log(`[MobileBrowserKeyboard] CSS applied - visible: ${isVisible}, height: ${height}px`);
  }, []);

  const detectKeyboardState = useCallback(() => {
    if (!isMobileBrowser || !hasVisualViewport || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    const vv = window.visualViewport;
    if (!vv || initialViewportHeight === 0) {
      isProcessingRef.current = false;
      return;
    }

    const currentHeight = vv.height;
    const heightDiff = initialViewportHeight - currentHeight;
    const ratioChange = heightDiff / initialViewportHeight;

    // Check if an input is focused
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && 
                          (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

    let isKeyboardVisible = false;
    let keyboardHeight = 0;

    // Enhanced detection logic
    if (isInputFocused && ratioChange > 0.25) {
      // Keyboard is likely visible if viewport shrunk by more than 25% and input is focused
      isKeyboardVisible = true;
      keyboardHeight = heightDiff;
    } else if (isInputFocused && heightDiff > 150) {
      // Fallback: if height difference is significant and input focused
      isKeyboardVisible = true;
      keyboardHeight = heightDiff;
    } else if (!isInputFocused && ratioChange < 0.1) {
      // No input focused and minimal height change = keyboard hidden
      isKeyboardVisible = false;
      keyboardHeight = 0;
    }

    const newState = { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      isReady: true 
    };
    
    setKeyboardState(newState);
    applyCSSVariables(isKeyboardVisible, keyboardHeight);

    console.log('[MobileBrowserKeyboard] State updated:', {
      currentHeight,
      initialHeight: initialViewportHeight,
      heightDiff,
      ratioChange,
      isInputFocused,
      activeElementTag: activeElement?.tagName,
      ...newState
    });
    
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 100);
  }, [isMobileBrowser, hasVisualViewport, initialViewportHeight, applyCSSVariables]);

  useEffect(() => {
    if (!isMobileBrowser || !hasVisualViewport) {
      setKeyboardState({ isVisible: false, height: 0, isReady: true });
      return;
    }

    console.log('[MobileBrowserKeyboard] Setting up enhanced mobile browser keyboard detection');

    // Initialize viewport height
    const vv = window.visualViewport;
    if (vv) {
      setInitialViewportHeight(vv.height);
      console.log('[MobileBrowserKeyboard] Initial viewport height:', vv.height);
    }

    const handleResize = () => {
      console.log('[MobileBrowserKeyboard] Viewport resize detected');
      setTimeout(detectKeyboardState, 50);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        console.log('[MobileBrowserKeyboard] Input focused:', target.tagName);
        // Longer delay for mobile browsers to settle
        setTimeout(detectKeyboardState, 300);
      }
    };

    const handleFocusOut = () => {
      console.log('[MobileBrowserKeyboard] Input blurred');
      // Shorter delay on blur
      setTimeout(detectKeyboardState, 100);
    };

    // Set up event listeners
    if (vv) {
      vv.addEventListener('resize', handleResize);
    }
    
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Initial state
    setTimeout(() => {
      setKeyboardState(prev => ({ ...prev, isReady: true }));
      detectKeyboardState();
    }, 100);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleResize);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isMobileBrowser, hasVisualViewport, detectKeyboardState]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    isReady: keyboardState.isReady
  };
};
