
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
    
    // FIXED: Update ALL matching elements, not just the first one
    const elementsToUpdate = [
      '.mobile-navigation',
      '.mobile-chat-interface',
      '.mobile-chat-input-container',
      '.mobile-chat-content'
    ];
    
    elementsToUpdate.forEach(selector => {
      const elements = document.querySelectorAll(selector); // Changed from querySelector
      console.log(`[KeyboardState] Found ${elements.length} elements for selector: ${selector}`);
      
      elements.forEach((element, index) => {
        element.classList.toggle('keyboard-visible', isVisible);
        console.log(`[KeyboardState] Updated element ${index + 1}/${elements.length} for ${selector}`);
      });
    });
    
    // Apply platform-specific classes to all navigation elements
    const navElements = document.querySelectorAll('.mobile-navigation');
    const inputElements = document.querySelectorAll('.mobile-chat-input-container');
    
    // Get platform info from body classes
    const isAndroid = document.body.classList.contains('platform-android');
    const isIOS = document.body.classList.contains('platform-ios');
    
    navElements.forEach(nav => {
      nav.classList.toggle('platform-android', isAndroid);
      nav.classList.toggle('platform-ios', isIOS);
    });
    
    inputElements.forEach(input => {
      input.classList.toggle('platform-android', isAndroid);
      input.classList.toggle('platform-ios', isIOS);
    });
    
    // Dispatch custom events for components that need to react
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, isVisible } 
    }));
    
    console.log(`[KeyboardState] Dispatched ${eventName} event with height: ${height}`);
  }, []);

  return {
    keyboardState,
    updateKeyboardState
  };
};
