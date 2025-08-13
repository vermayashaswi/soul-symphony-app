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
      
      // Add CSS class for styling
      document.body.classList.add('capacitor-keyboard-visible');
    };

    const handleKeyboardHide = () => {
      console.log('[SimplifiedKeyboard] Keyboard hidden');
      setKeyboardInfo({
        isVisible: false,
        height: 0
      });
      
      // Remove CSS class
      document.body.classList.remove('capacitor-keyboard-visible');
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
      document.body.classList.remove('capacitor-keyboard-visible');
    };
  }, [isNative]);

  return {
    isKeyboardVisible: keyboardInfo.isVisible,
    keyboardHeight: keyboardInfo.height,
    platform,
    isNative
  };
};