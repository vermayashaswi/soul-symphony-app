
import { useState, useCallback } from 'react';

interface KeyboardState {
  isVisible: boolean;
  height: number;
  previousHeight: number;
}

export const useKeyboardState = () => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    previousHeight: 0
  });

  const updateKeyboardState = useCallback((isVisible: boolean, height: number = 0) => {
    setKeyboardState(prev => {
      if (prev.isVisible === isVisible && prev.height === height) {
        return prev;
      }
      
      console.log('[KeyboardState] State change:', { 
        from: { visible: prev.isVisible, height: prev.height },
        to: { visible: isVisible, height }
      });
      
      return {
        isVisible,
        height,
        previousHeight: prev.height
      };
    });

    // Update CSS classes and variables
    document.body.classList.toggle('keyboard-visible', isVisible);
    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    
    // Update specific components with class toggles
    const elementsToUpdate = [
      '.mobile-navigation',
      '.mobile-chat-interface',
      '.mobile-chat-input-container',
      '.mobile-chat-content'
    ];
    
    elementsToUpdate.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.classList.toggle('keyboard-visible', isVisible);
      }
    });
    
    // Dispatch custom events for components that need to react
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, isVisible } 
    }));
  }, []);

  return {
    keyboardState,
    updateKeyboardState
  };
};
