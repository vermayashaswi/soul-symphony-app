
import { useEffect, useState, useCallback } from 'react';

export const useKeyboardDetection = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleKeyboardChange = useCallback((visible: boolean, height = 0) => {
    console.log('[KeyboardDetection] Keyboard state changed:', { visible, height });
    setIsKeyboardVisible(visible);
    setKeyboardHeight(height);
    
    // Update body classes for CSS targeting
    if (visible) {
      document.body.classList.add('keyboard-visible');
      document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    } else {
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    }
    
    // Dispatch custom events for other components
    const eventName = visible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, visible } 
    }));
  }, []);

  useEffect(() => {
    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        const isKeyboard = heightDiff > 150; // Threshold for keyboard detection
        const height = isKeyboard ? heightDiff : 0;
        
        handleKeyboardChange(isKeyboard, height);
      }
    };

    // Initial check
    handleVisualViewportChange();
    
    // Set up listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }
    
    // Fallback for older browsers
    const handleWindowResize = () => {
      setTimeout(handleVisualViewportChange, 100);
    };
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
      window.removeEventListener('resize', handleWindowResize);
      
      // Cleanup
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--keyboard-height');
    };
  }, [handleKeyboardChange]);

  return {
    isKeyboardVisible,
    keyboardHeight
  };
};
