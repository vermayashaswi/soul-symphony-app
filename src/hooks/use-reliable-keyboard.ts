import { useState, useEffect, useCallback, useMemo } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { usePlatformDetection } from './use-platform-detection';

interface KeyboardState {
  isVisible: boolean;
  height: number;
}

interface ViewportInfo {
  height: number;
  width: number;
  scale: number;
  offsetTop: number;
}

/**
 * Enhanced reliable keyboard detection hook with multi-layered fallback system
 * Designed specifically to fix mobile browser keyboard gaps
 */
export const useReliableKeyboard = () => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({ isVisible: false, height: 0 });
  const [initialViewportHeight, setInitialViewportHeight] = useState<number>(0);
  const [currentViewportInfo, setCurrentViewportInfo] = useState<ViewportInfo | null>(null);
  const { isNative, platform } = usePlatformDetection();

  // Enhanced mobile browser detection
  const isMobileBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /android|iphone|ipad|ipod|mobile|webos|blackberry|iemobile|opera mini/i.test(ua);
  }, []);

  // Device-specific keyboard height presets for fallback
  const estimatedKeyboardHeight = useMemo(() => {
    if (typeof navigator === 'undefined') return 300;
    const ua = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/i.test(ua)) {
      // iPhone keyboard heights: varies by device
      return window.screen.height < 700 ? 260 : 270;
    } else if (/android/i.test(ua)) {
      // Android keyboard heights: varies by keyboard and device
      return Math.min(320, window.screen.height * 0.4);
    }
    
    return 300; // Default fallback
  }, []);

  // Enhanced keyboard detection threshold
  const keyboardThreshold = useMemo(() => {
    const baseThreshold = 50;
    const viewportRatioThreshold = 0.75; // If viewport shrinks to <75% of original
    
    if (initialViewportHeight > 0) {
      const ratioThreshold = initialViewportHeight * viewportRatioThreshold;
      return Math.max(baseThreshold, initialViewportHeight - ratioThreshold);
    }
    
    return baseThreshold;
  }, [initialViewportHeight]);

  // Enhanced viewport monitoring
  const updateViewportInfo = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    const vv = window.visualViewport;
    if (vv) {
      return {
        height: vv.height,
        width: vv.width,
        scale: vv.scale,
        offsetTop: vv.offsetTop
      };
    }
    
    return {
      height: window.innerHeight,
      width: window.innerWidth,
      scale: 1,
      offsetTop: 0
    };
  }, []);

  // Function to apply keyboard-related CSS classes and properties with enhanced positioning
  const applyKeyboardClasses = useCallback((isVisible: boolean, height: number) => {
    const body = document.body;
    const html = document.documentElement;
    
    // Apply/remove keyboard visibility classes
    if (isVisible) {
      body.classList.add('keyboard-visible');
      html.classList.add('keyboard-visible');
      
      // Apply platform-specific classes
      if (platform === 'ios') {
        body.classList.add('platform-ios');
      } else if (platform === 'android') {
        body.classList.add('platform-android');
      }
      
      if (isNative) {
        body.classList.add('platform-native');
      }
      
      // Add mobile browser class for enhanced detection
      if (isMobileBrowser && !isNative) {
        body.classList.add('mobile-browser');
      }
    } else {
      body.classList.remove('keyboard-visible', 'mobile-browser');
      html.classList.remove('keyboard-visible');
    }
    
    // Set CSS custom properties for keyboard height with enhanced accuracy
    const keyboardHeightValue = isVisible ? `${height}px` : '0px';
    body.style.setProperty('--keyboard-height', keyboardHeightValue);
    html.style.setProperty('--keyboard-height', keyboardHeightValue);
    
    // Enhanced mobile chat input container positioning
    const inputContainers = document.querySelectorAll('.mobile-chat-input-container');
    inputContainers.forEach((container: Element) => {
      const element = container as HTMLElement;
      
      if (isVisible) {
        element.classList.add('keyboard-visible');
        if (platform === 'ios') element.classList.add('platform-ios');
        if (platform === 'android') element.classList.add('platform-android');
        if (isNative) element.classList.add('platform-native');
        if (isMobileBrowser && !isNative) element.classList.add('mobile-browser');
        
        // Apply direct transform for more reliable positioning on mobile browsers
        if (isMobileBrowser && !isNative) {
          element.style.setProperty('transform', `translateY(-${height}px)`);
          element.style.setProperty('bottom', '0px');
          element.style.setProperty('position', 'fixed');
          element.style.setProperty('will-change', 'transform');
        }
      } else {
        element.classList.remove('keyboard-visible', 'platform-ios', 'platform-android', 'platform-native', 'mobile-browser');
        
        // Reset transform and positioning
        if (isMobileBrowser && !isNative) {
          element.style.removeProperty('transform');
          element.style.setProperty('bottom', 'var(--nav-bar-height)');
        }
      }
    });

    // Apply content adjustments
    const chatContents = document.querySelectorAll('.mobile-chat-content');
    chatContents.forEach((content: Element) => {
      const element = content as HTMLElement;
      
      if (isVisible) {
        element.classList.add('keyboard-visible');
        // Ensure content is properly padded above the input
        const inputHeight = 80; // Approximate input container height
        element.style.setProperty('padding-bottom', `${height + inputHeight + 20}px`);
      } else {
        element.classList.remove('keyboard-visible');
        element.style.removeProperty('padding-bottom');
      }
    });

    console.log(`[ReliableKeyboard] Enhanced keyboard ${isVisible ? 'shown' : 'hidden'}, height: ${height}px, mobile: ${isMobileBrowser}, native: ${isNative}`);
  }, [platform, isNative, isMobileBrowser]);

  // Initialize viewport measurements
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const info = updateViewportInfo();
      setCurrentViewportInfo(info);
      setInitialViewportHeight(info?.height || window.innerHeight || 0);
      
      console.log('[useReliableKeyboard] Initial viewport:', {
        info,
        isMobileBrowser,
        estimatedKeyboardHeight
      });
    }
  }, [updateViewportInfo, isMobileBrowser, estimatedKeyboardHeight]);

  useEffect(() => {
    let keyboardWillShowListener: any;
    let keyboardDidShowListener: any;
    let keyboardWillHideListener: any;
    let keyboardDidHideListener: any;

    // Handle native Capacitor environment
    if (isNative) {
      console.log('[useReliableKeyboard] Setting up native keyboard listeners');
      
      keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (info) => {
        console.log('[useReliableKeyboard] [Native] Keyboard will show:', info);
        const height = info.keyboardHeight || 0;
        setKeyboardState({ isVisible: true, height });
        applyKeyboardClasses(true, height);
      });

      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (info) => {
        console.log('[useReliableKeyboard] [Native] Keyboard did show:', info);
        const height = info.keyboardHeight || 0;
        setKeyboardState({ isVisible: true, height });
        applyKeyboardClasses(true, height);
      });

      keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
        console.log('[useReliableKeyboard] [Native] Keyboard will hide');
        setKeyboardState({ isVisible: false, height: 0 });
        applyKeyboardClasses(false, 0);
      });

      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        console.log('[useReliableKeyboard] [Native] Keyboard did hide');
        setKeyboardState({ isVisible: false, height: 0 });
        applyKeyboardClasses(false, 0);
      });
    } else {
      // Enhanced web environment detection
      console.log('[useReliableKeyboard] Setting up enhanced web keyboard detection');
      
      const handleVisualViewportChange = () => {
        const info = updateViewportInfo();
        if (!info) return;
        
        setCurrentViewportInfo(info);
        
        console.log('[useReliableKeyboard] [Web] Visual viewport change:', {
          current: info,
          initial: initialViewportHeight,
          threshold: keyboardThreshold
        });

        // Multi-layer keyboard detection
        let isKeyboardVisible = false;
        let keyboardHeight = 0;

        // Method 1: Visual Viewport height difference (most accurate)
        if (window.visualViewport && initialViewportHeight > 0) {
          const heightDiff = initialViewportHeight - info.height;
          if (heightDiff > keyboardThreshold) {
            isKeyboardVisible = true;
            keyboardHeight = heightDiff;
          }
        }

        // Method 2: Viewport ratio detection (backup)
        if (!isKeyboardVisible && initialViewportHeight > 0) {
          const currentRatio = info.height / initialViewportHeight;
          if (currentRatio < 0.75) { // Viewport shrunk significantly
            isKeyboardVisible = true;
            keyboardHeight = initialViewportHeight - info.height;
          }
        }

        // Method 3: Offset detection (iOS specific)
        if (!isKeyboardVisible && info.offsetTop > 0) {
          isKeyboardVisible = true;
          keyboardHeight = info.offsetTop;
        }

        // Method 4: Fallback estimation for mobile browsers
        if (!isKeyboardVisible && isMobileBrowser) {
          const minExpectedHeight = window.screen.height * 0.6;
          if (info.height < minExpectedHeight) {
            isKeyboardVisible = true;
            keyboardHeight = estimatedKeyboardHeight;
          }
        }

        console.log('[useReliableKeyboard] [Web] Detection result:', {
          isKeyboardVisible,
          keyboardHeight,
          method: isKeyboardVisible ? 'viewport-analysis' : 'none'
        });

        setKeyboardState({ isVisible: isKeyboardVisible, height: keyboardHeight });
        applyKeyboardClasses(isKeyboardVisible, keyboardHeight);
      };

      const handleResize = () => {
        // Immediate response for resize events
        setTimeout(handleVisualViewportChange, 10);
      };

      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          console.log('[useReliableKeyboard] [Web] Input focused, triggering detection');
          
          // On mobile browsers, keyboard often appears after focus
          if (isMobileBrowser) {
            setTimeout(() => {
              handleVisualViewportChange();
            }, 300); // Give keyboard time to appear
          }
        }
      };

      const handleFocusOut = () => {
        if (isMobileBrowser) {
          console.log('[useReliableKeyboard] [Web] Input blurred, checking for keyboard hide');
          setTimeout(() => {
            handleVisualViewportChange();
          }, 100);
        }
      };

      // Set up enhanced event listeners
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      }
      
      window.addEventListener('resize', handleResize);
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      
      // Initial detection
      setTimeout(handleVisualViewportChange, 100);
      
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        }
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }

    return () => {
      if (isNative) {
        keyboardWillShowListener?.remove();
        keyboardDidShowListener?.remove();
        keyboardWillHideListener?.remove();
        keyboardDidHideListener?.remove();
      }
    };
  }, [isNative, applyKeyboardClasses, initialViewportHeight, keyboardThreshold, updateViewportInfo, isMobileBrowser, estimatedKeyboardHeight]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    platform,
    isNative
  };
};