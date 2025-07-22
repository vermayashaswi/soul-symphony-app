
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
        to: { visible: isVisible, height },
        timestamp: new Date().toISOString()
      });
      
      return {
        isVisible,
        height,
        previousHeight: prev.height
      };
    });

    // Update CSS classes and variables on document body for higher specificity
    document.body.classList.toggle('keyboard-visible', isVisible);
    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    
    // Apply keyboard state to all relevant elements with safety checks
    const elementsToUpdate = [
      { selector: '.mobile-navigation', className: 'keyboard-visible' },
      { selector: '.mobile-chat-interface', className: 'keyboard-visible' },
      { selector: '.mobile-chat-input-container', className: 'keyboard-visible' },
      { selector: '.mobile-chat-content', className: 'keyboard-visible' }
    ];
    
    elementsToUpdate.forEach(({ selector, className }) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && element.classList) {
          element.classList.toggle(className, isVisible);
        }
      });
    });
    
    // Add debug attributes for troubleshooting
    document.documentElement.setAttribute('data-keyboard-visible', isVisible.toString());
    document.documentElement.setAttribute('data-keyboard-height', height.toString());
    
    // Dispatch custom events for components that need to react
    const eventName = isVisible ? 'keyboardOpen' : 'keyboardClose';
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: { height, isVisible, timestamp: Date.now() } 
    }));
    
    // Additional logging for debugging
    console.log('[KeyboardState] Applied classes to elements:', {
      bodyHasClass: document.body.classList.contains('keyboard-visible'),
      elementsUpdated: elementsToUpdate.map(({ selector }) => ({
        selector,
        count: document.querySelectorAll(selector).length,
        hasClass: Array.from(document.querySelectorAll(selector)).map(el => 
          el.classList.contains('keyboard-visible')
        )
      }))
    });
  }, []);

  return {
    keyboardState,
    updateKeyboardState
  };
};
