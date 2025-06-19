
import { useEffect, useCallback, useRef } from 'react';
import { useIsMobile } from './use-mobile';

interface ViewportInfo {
  windowHeight: number;
  visualHeight: number;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  availableHeight: number;
}

interface WebtonativeViewportHook {
  viewportInfo: ViewportInfo;
  updateViewport: () => void;
  isKeyboardOpen: boolean;
}

export function useWebtonativeViewport(): WebtonativeViewportHook {
  const { isWebtonative, isAndroid, isIOS } = useIsMobile();
  const viewportInfoRef = useRef<ViewportInfo>({
    windowHeight: window.innerHeight,
    visualHeight: window.visualViewport?.height || window.innerHeight,
    keyboardHeight: 0,
    isKeyboardOpen: false,
    availableHeight: window.innerHeight
  });

  const updateViewport = useCallback(() => {
    const windowHeight = window.innerHeight;
    const visualHeight = window.visualViewport?.height || windowHeight;
    const keyboardHeight = Math.max(0, windowHeight - visualHeight);
    const isKeyboardOpen = keyboardHeight > 150; // Threshold for keyboard detection
    const availableHeight = isKeyboardOpen ? visualHeight : windowHeight;

    // Update viewport info
    viewportInfoRef.current = {
      windowHeight,
      visualHeight,
      keyboardHeight,
      isKeyboardOpen,
      availableHeight
    };

    // Update CSS custom properties for dynamic viewport management
    const root = document.documentElement;
    root.style.setProperty('--vh', `${windowHeight * 0.01}px`);
    root.style.setProperty('--real-vh', `${windowHeight}px`);
    root.style.setProperty('--visual-vh', `${visualHeight * 0.01}px`);
    root.style.setProperty('--available-height', `${availableHeight}px`);
    root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

    // Update body classes for keyboard state
    const body = document.body;
    const html = document.documentElement;
    
    if (isKeyboardOpen) {
      body.classList.add('keyboard-visible');
      html.classList.add('webtonative-keyboard-open');
      
      // Add auth-specific classes if on auth page
      const authPage = document.querySelector('.auth-page');
      const authContainer = document.querySelector('.auth-container');
      if (authPage) {
        authPage.classList.add('keyboard-visible', 'webtonative-keyboard-open');
      }
      if (authContainer) {
        authContainer.classList.add('keyboard-visible', 'webtonative-keyboard-open');
      }
    } else {
      body.classList.remove('keyboard-visible');
      html.classList.remove('webtonative-keyboard-open');
      
      // Remove auth-specific classes
      const authPage = document.querySelector('.auth-page');
      const authContainer = document.querySelector('.auth-container');
      if (authPage) {
        authPage.classList.remove('keyboard-visible', 'webtonative-keyboard-open');
      }
      if (authContainer) {
        authContainer.classList.remove('keyboard-visible', 'webtonative-keyboard-open');
      }
    }

    console.log('[WebtonativeViewport] Viewport updated:', {
      windowHeight,
      visualHeight,
      keyboardHeight,
      isKeyboardOpen,
      availableHeight,
      isWebtonative,
      isAndroid,
      isIOS
    });
  }, [isWebtonative, isAndroid, isIOS]);

  useEffect(() => {
    if (!isWebtonative) {
      return;
    }

    console.log('[WebtonativeViewport] Setting up viewport management for webtonative');

    // Set initial viewport
    updateViewport();

    // Set up event listeners for viewport changes
    const handleResize = () => {
      console.log('[WebtonativeViewport] Window resize detected');
      updateViewport();
    };

    const handleVisualViewportChange = () => {
      console.log('[WebtonativeViewport] Visual viewport change detected');
      updateViewport();
    };

    const handleOrientationChange = () => {
      console.log('[WebtonativeViewport] Orientation change detected');
      // Delay to account for orientation change timing
      setTimeout(() => {
        updateViewport();
      }, 300);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    // Enhanced Android webview support
    if (isAndroid) {
      // Additional Android-specific viewport handling
      const handleAndroidKeyboard = () => {
        console.log('[WebtonativeViewport] Android keyboard event detected');
        setTimeout(updateViewport, 100);
      };

      // Listen for focus events on inputs (keyboard might open)
      document.addEventListener('focusin', handleAndroidKeyboard);
      document.addEventListener('focusout', handleAndroidKeyboard);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleOrientationChange);
        document.removeEventListener('focusin', handleAndroidKeyboard);
        document.removeEventListener('focusout', handleAndroidKeyboard);
        
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
          window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
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
    };
  }, [isWebtonative, isAndroid, updateViewport]);

  return {
    viewportInfo: viewportInfoRef.current,
    updateViewport,
    isKeyboardOpen: viewportInfoRef.current.isKeyboardOpen
  };
}
