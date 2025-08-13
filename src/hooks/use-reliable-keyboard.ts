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
      // For web, use simpler focus-based detection
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          console.log('[ReliableKeyboard] Input focused on web');
          const newState = { isVisible: true, height: 280 }; // Estimated keyboard height
          setKeyboardState(newState);
          applyKeyboardClasses(true, 280);
        }
      };

      const handleFocusOut = () => {
        console.log('[ReliableKeyboard] Input blurred on web');
        const newState = { isVisible: false, height: 0 };
        setKeyboardState(newState);
        applyKeyboardClasses(false, 0);
      };

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
        applyKeyboardClasses(false, 0);
      };
    }

    // For native apps, use Capacitor keyboard events
    let showListener: any;
    let hideListener: any;

    const setupListeners = async () => {
      try {
        showListener = await Keyboard.addListener('keyboardWillShow', (info: any) => {
          console.log('[ReliableKeyboard] Native keyboard shown:', info);
          const height = info.keyboardHeight || 280;
          const newState = { isVisible: true, height };
          setKeyboardState(newState);
          applyKeyboardClasses(true, height);
        });

        hideListener = await Keyboard.addListener('keyboardWillHide', () => {
          console.log('[ReliableKeyboard] Native keyboard hidden');
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