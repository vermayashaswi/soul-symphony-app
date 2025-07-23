
import { useEffect, useState } from 'react';

interface KeyboardState {
  isVisible: boolean;
  height: number;
  platform: 'ios' | 'android' | 'web';
}

export const useKeyboardState = () => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    platform: 'web'
  });

  useEffect(() => {
    // PHASE 2 FIX: Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'web';

    console.log('[useKeyboardState] PHASE 2 FIX: Platform detected:', platform);

    // PHASE 2 FIX: Enhanced keyboard detection
    const handleKeyboardShow = (e: any) => {
      console.log('[useKeyboardState] PHASE 2 FIX: Keyboard shown');
      setKeyboardState({
        isVisible: true,
        height: e.keyboardHeight || 0,
        platform
      });

      // Hide navigation bar when keyboard is visible
      const navigation = document.querySelector('.mobile-navigation');
      if (navigation) {
        navigation.classList.add('keyboard-visible');
      }
    };

    const handleKeyboardHide = () => {
      console.log('[useKeyboardState] PHASE 2 FIX: Keyboard hidden');
      setKeyboardState({
        isVisible: false,
        height: 0,
        platform
      });

      // Show navigation bar when keyboard is hidden
      const navigation = document.querySelector('.mobile-navigation');
      if (navigation) {
        navigation.classList.remove('keyboard-visible');
      }
    };

    // Listen for Capacitor keyboard events
    if (window.Capacitor && window.Capacitor.Plugins.Keyboard) {
      window.Capacitor.Plugins.Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
      window.Capacitor.Plugins.Keyboard.addListener('keyboardWillHide', handleKeyboardHide);
    }

    // Fallback for web browsers
    const handleResize = () => {
      if (platform === 'web') {
        const viewportHeight = window.innerHeight;
        const screenHeight = window.screen.height;
        const heightDiff = screenHeight - viewportHeight;
        
        if (heightDiff > 200) { // Threshold for keyboard detection
          setKeyboardState({
            isVisible: true,
            height: heightDiff,
            platform
          });
        } else {
          setKeyboardState({
            isVisible: false,
            height: 0,
            platform
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (window.Capacitor && window.Capacitor.Plugins.Keyboard) {
        window.Capacitor.Plugins.Keyboard.removeAllListeners();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return keyboardState;
};
