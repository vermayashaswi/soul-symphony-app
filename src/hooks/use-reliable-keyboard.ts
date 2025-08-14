import { useEffect, useState, useCallback } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { usePlatformDetection } from './use-platform-detection';

interface KeyboardState {
  isVisible: boolean;
  height: number;
}

/**
 * Reliable keyboard detection hook that uses multiple methods for cross-platform compatibility
 * Focuses on simplicity and reliability over complex viewport calculations
 */
export const useReliableKeyboard = () => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0
  });
  
  const { isNative, platform } = usePlatformDetection();

  // Apply keyboard classes to specific elements that need repositioning
  const applyKeyboardClasses = useCallback((isVisible: boolean, height: number = 0) => {
    const elements = [
      '.mobile-navigation',
      '.mobile-chat-input-container',
      '.mobile-chat-content'
    ];

    elements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.classList.toggle('keyboard-visible', isVisible);
        element.classList.toggle(`platform-${platform}`, isVisible);
        
        if (isVisible) {
          element.setAttribute('data-keyboard-height', height.toString());
        } else {
          element.removeAttribute('data-keyboard-height');
        }
      }
    });

    // Set CSS custom properties for dynamic height adjustments
    if (isVisible) {
      document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
      document.documentElement.style.setProperty('--keyboard-visible', '1');
    } else {
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.style.removeProperty('--keyboard-visible');
    }

    console.log(`[ReliableKeyboard] Keyboard ${isVisible ? 'shown' : 'hidden'}, height: ${height}px`);
  }, [platform]);

  useEffect(() => {
    if (!isNative) {
      // For web, use Visual Viewport API when available, otherwise use focus detection
      let keyboardHeight = 0;
      
      const handleVisualViewportChange = () => {
        if (window.visualViewport) {
          const heightDifference = window.innerHeight - window.visualViewport.height;
          // Lowered threshold from 150px to 100px for better mobile browser sensitivity
          const isKeyboardVisible = heightDifference > 100;
          keyboardHeight = isKeyboardVisible ? heightDifference : 0;
          
          console.log('[ReliableKeyboard] Visual viewport change:', { 
            innerHeight: window.innerHeight, 
            viewportHeight: window.visualViewport.height, 
            heightDifference, 
            isKeyboardVisible,
            userAgent: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
          });
          
          const newState = { isVisible: isKeyboardVisible, height: keyboardHeight };
          setKeyboardState(newState);
          applyKeyboardClasses(isKeyboardVisible, keyboardHeight);
        }
      };

      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          console.log('[ReliableKeyboard] Input focused on web');
          
          // Immediate class application for better responsiveness
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const estimatedHeight = isMobile ? 320 : 280; // Higher estimate for mobile browsers
          
          // Apply classes immediately without delay for better UX
          if (window.visualViewport) {
            // Check immediately and also set up for resize events
            handleVisualViewportChange();
            setTimeout(handleVisualViewportChange, 50); // Backup check
          } else {
            console.log('[ReliableKeyboard] Using fallback height estimation:', estimatedHeight);
            const newState = { isVisible: true, height: estimatedHeight };
            setKeyboardState(newState);
            applyKeyboardClasses(true, estimatedHeight);
          }
        }
      };

      const handleFocusOut = () => {
        console.log('[ReliableKeyboard] Input blurred on web');
        
        // Reduced delay for faster response, with backup check
        setTimeout(() => {
          if (window.visualViewport) {
            handleVisualViewportChange();
          } else {
            const newState = { isVisible: false, height: 0 };
            setKeyboardState(newState);
            applyKeyboardClasses(false, 0);
          }
        }, 50); // Reduced from 100ms to 50ms
        
        // Additional backup check with longer delay for tricky scenarios
        setTimeout(() => {
          if (window.visualViewport) {
            const heightDifference = window.innerHeight - window.visualViewport.height;
            if (heightDifference <= 100) {
              const newState = { isVisible: false, height: 0 };
              setKeyboardState(newState);
              applyKeyboardClasses(false, 0);
            }
          }
        }, 200);
      };

      // Set up Visual Viewport API listener if available
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      }

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        }
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
        applyKeyboardClasses(false, 0);
      };
    }

    // For native apps, use enhanced Capacitor keyboard events
    let showListener: any;
    let hideListener: any;
    let didShowListener: any;
    let didHideListener: any;

    const setupListeners = async () => {
      try {
        // Use both willShow and didShow for more reliable detection
        showListener = await Keyboard.addListener('keyboardWillShow', (info: any) => {
          console.log('[ReliableKeyboard] Native keyboard will show:', info);
          const height = info.keyboardHeight || 280;
          const newState = { isVisible: true, height };
          setKeyboardState(newState);
          applyKeyboardClasses(true, height);
        });

        didShowListener = await Keyboard.addListener('keyboardDidShow', (info: any) => {
          console.log('[ReliableKeyboard] Native keyboard did show:', info);
          const height = info.keyboardHeight || 280;
          // Only update if height is different or state is not visible
          setKeyboardState(prev => {
            if (!prev.isVisible || prev.height !== height) {
              const newState = { isVisible: true, height };
              applyKeyboardClasses(true, height);
              return newState;
            }
            return prev;
          });
        });

        hideListener = await Keyboard.addListener('keyboardWillHide', () => {
          console.log('[ReliableKeyboard] Native keyboard will hide');
          const newState = { isVisible: false, height: 0 };
          setKeyboardState(newState);
          applyKeyboardClasses(false, 0);
        });

        didHideListener = await Keyboard.addListener('keyboardDidHide', () => {
          console.log('[ReliableKeyboard] Native keyboard did hide');
          // Ensure cleanup
          const newState = { isVisible: false, height: 0 };
          setKeyboardState(newState);
          applyKeyboardClasses(false, 0);
        });
      } catch (error) {
        console.error('[ReliableKeyboard] Failed to setup native listeners:', error);
      }
    };

    setupListeners();

    return () => {
      if (showListener) showListener.remove();
      if (hideListener) hideListener.remove();
      if (didShowListener) didShowListener.remove();
      if (didHideListener) didHideListener.remove();
      applyKeyboardClasses(false, 0);
    };
  }, [isNative, applyKeyboardClasses]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    platform,
    isNative
  };
};