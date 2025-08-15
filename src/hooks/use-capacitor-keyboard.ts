import { useState, useEffect, useCallback } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { useEnvironmentDetection } from './use-environment-detection';

interface CapacitorKeyboardState {
  isVisible: boolean;
  height: number;
  isReady: boolean;
}

/**
 * Capacitor-specific keyboard handling with native positioning
 */
export const useCapacitorKeyboard = () => {
  const [keyboardState, setKeyboardState] = useState<CapacitorKeyboardState>({
    isVisible: false,
    height: 0,
    isReady: false
  });

  const { isCapacitorWebView, platform } = useEnvironmentDetection();

  const applyCapacitorKeyboardStyles = useCallback((isVisible: boolean, height: number) => {
    const body = document.body;
    const html = document.documentElement;
    
    // Apply Capacitor-specific classes
    if (isVisible) {
      body.classList.add('capacitor-keyboard-visible');
      html.classList.add('capacitor-keyboard-visible');
    } else {
      body.classList.remove('capacitor-keyboard-visible');
      html.classList.remove('capacitor-keyboard-visible');
    }

    // Set keyboard height for Capacitor
    const keyboardHeightValue = isVisible ? `${height}px` : '0px';
    body.style.setProperty('--capacitor-keyboard-height', keyboardHeightValue);
    html.style.setProperty('--capacitor-keyboard-height', keyboardHeightValue);

    // Apply direct positioning to input containers
    const inputContainers = document.querySelectorAll('.mobile-chat-input-container');
    inputContainers.forEach((container: Element) => {
      const element = container as HTMLElement;
      
      if (isVisible) {
        element.classList.add('capacitor-keyboard-visible');
        // Direct positioning for Capacitor - stick to keyboard top
        element.style.setProperty('position', 'fixed');
        element.style.setProperty('bottom', '0px');
        element.style.setProperty('transform', 'none');
        element.style.setProperty('will-change', 'auto');
        element.style.setProperty('z-index', '1000');
      } else {
        element.classList.remove('capacitor-keyboard-visible');
        // Reset to safe area positioning
        element.style.setProperty('bottom', 'env(safe-area-inset-bottom, 0px)');
        element.style.setProperty('transform', 'translateZ(0)');
      }
    });

    console.log(`[CapacitorKeyboard] Keyboard ${isVisible ? 'shown' : 'hidden'}, height: ${height}px`);
  }, []);

  useEffect(() => {
    if (!isCapacitorWebView) {
      setKeyboardState({ isVisible: false, height: 0, isReady: true });
      return;
    }

    console.log('[CapacitorKeyboard] Setting up Capacitor keyboard listeners');

    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (info) => {
      const height = info.keyboardHeight || 0;
      setKeyboardState({ isVisible: true, height, isReady: true });
      applyCapacitorKeyboardStyles(true, height);
    });

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (info) => {
      const height = info.keyboardHeight || 0;
      setKeyboardState({ isVisible: true, height, isReady: true });
      applyCapacitorKeyboardStyles(true, height);
    });

    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardState({ isVisible: false, height: 0, isReady: true });
      applyCapacitorKeyboardStyles(false, 0);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardState({ isVisible: false, height: 0, isReady: true });
      applyCapacitorKeyboardStyles(false, 0);
    });

    // Configure Capacitor keyboard
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    Keyboard.setScroll({ isDisabled: false }).catch(() => {});
    // Configure resize mode if needed

    setKeyboardState(prev => ({ ...prev, isReady: true }));

    return () => {
      keyboardWillShowListener.then(listener => listener.remove()).catch(() => {});
      keyboardDidShowListener.then(listener => listener.remove()).catch(() => {});
      keyboardWillHideListener.then(listener => listener.remove()).catch(() => {});
      keyboardDidHideListener.then(listener => listener.remove()).catch(() => {});
    };
  }, [isCapacitorWebView, applyCapacitorKeyboardStyles]);

  const hideKeyboard = useCallback(async () => {
    if (isCapacitorWebView) {
      try {
        await Keyboard.hide();
        // Android WebViews sometimes need a second call
        if (platform === 'android') {
          setTimeout(() => {
            Keyboard.hide().catch(() => {});
          }, 50);
        }
      } catch (error) {
        console.warn('[CapacitorKeyboard] Failed to hide keyboard:', error);
      }
    }
  }, [isCapacitorWebView, platform]);

  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    isReady: keyboardState.isReady,
    hideKeyboard
  };
};