import { useEffect, useState } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { usePlatformDetection } from './use-platform-detection';

interface KeyboardInfo {
  isVisible: boolean;
  height: number;
}

/**
 * Simplified keyboard hook that relies on Capacitor's native keyboard events
 * instead of complex viewport detection that conflicts with swipe gestures
 */
export const useSimplifiedKeyboard = () => {
  const [keyboardInfo, setKeyboardInfo] = useState<KeyboardInfo>({
    isVisible: false,
    height: 0
  });
  const { isNative, platform } = usePlatformDetection();

  useEffect(() => {
    if (!isNative) return;

    const handleKeyboardShow = (info: any) => {
      console.log('[SimplifiedKeyboard] Keyboard shown:', info);
      setKeyboardInfo({
        isVisible: true,
        height: info.keyboardHeight || 0
      });
      
      // Add keyboard-visible class to specific elements that need repositioning
      const elements = [
        '.mobile-navigation',
        '.mobile-chat-input-container', 
        '.mobile-chat-content'
      ];
      
      elements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          element.classList.add('keyboard-visible');
          // Add platform class for platform-specific styles
          if (platform === 'android') element.classList.add('platform-android');
          if (platform === 'ios') element.classList.add('platform-ios');
        }
      });
      
      // Also add to body for legacy compatibility
      document.body.classList.add('keyboard-visible');
      console.log('[SimplifiedKeyboard] Added keyboard-visible classes to elements');
    };

    const handleKeyboardHide = () => {
      console.log('[SimplifiedKeyboard] Keyboard hidden');
      setKeyboardInfo({
        isVisible: false,
        height: 0
      });
      
      // Remove keyboard-visible class from specific elements
      const elements = [
        '.mobile-navigation',
        '.mobile-chat-input-container',
        '.mobile-chat-content'
      ];
      
      elements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          element.classList.remove('keyboard-visible');
          element.classList.remove('platform-android');
          element.classList.remove('platform-ios');
        }
      });
      
      // Also remove from body for legacy compatibility
      document.body.classList.remove('keyboard-visible');
      console.log('[SimplifiedKeyboard] Removed keyboard-visible classes from elements');
    };

    // Use Capacitor's native keyboard events
    let showListener: any;
    let hideListener: any;

    const setupListeners = async () => {
      showListener = await Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
      hideListener = await Keyboard.addListener('keyboardWillHide', handleKeyboardHide);
    };

    setupListeners();

    return () => {
      if (showListener) showListener.remove();
      if (hideListener) hideListener.remove();
      
      // Clean up all classes on unmount
      const elements = [
        '.mobile-navigation',
        '.mobile-chat-input-container',
        '.mobile-chat-content'
      ];
      
      elements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          element.classList.remove('keyboard-visible');
          element.classList.remove('platform-android');
          element.classList.remove('platform-ios');
        }
      });
      
      document.body.classList.remove('keyboard-visible');
    };
  }, [isNative]);

  return {
    isKeyboardVisible: keyboardInfo.isVisible,
    keyboardHeight: keyboardInfo.height,
    platform,
    isNative
  };
};