
import { useEffect, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;
  keyboardAware?: boolean; // New option to disable during keyboard interaction
  debugMode?: boolean; // New option for debugging
}

export function useSwipeGesture(
  elementRef: RefObject<HTMLElement>,
  options: SwipeOptions
) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element || options.disabled) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = options.minDistance || 50;
    let isSwiping = false;
    let startTarget: EventTarget | null = null;
    let keyboardVisible = false;
    let isInputFocused = false;

    // Enhanced input element detection
    const isInputElement = (element: HTMLElement): boolean => {
      const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      const interactiveTags = ['BUTTON', 'A'];
      
      // Direct input elements
      if (inputTags.includes(element.tagName)) return true;
      
      // Contenteditable elements
      if (element.isContentEditable) return true;
      
      // Elements with input-like roles
      const role = element.getAttribute('role');
      if (role && ['textbox', 'searchbox', 'combobox'].includes(role)) return true;
      
      // Check for parent input elements (for complex input components)
      const closestInput = element.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"]');
      if (closestInput) return true;
      
      // Check for data attributes that indicate input behavior
      if (element.dataset.input === 'true' || element.classList.contains('input-field')) return true;
      
      return false;
    };

    // Keyboard state listeners
    const handleKeyboardOpen = (e: CustomEvent) => {
      keyboardVisible = true;
      if (options.debugMode) {
        console.log('[SwipeGesture] Keyboard opened, height:', e.detail.height);
      }
    };

    const handleKeyboardClose = () => {
      keyboardVisible = false;
      if (options.debugMode) {
        console.log('[SwipeGesture] Keyboard closed');
      }
    };

    const handleInputFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (isInputElement(target)) {
        isInputFocused = true;
        if (options.debugMode) {
          console.log('[SwipeGesture] Input focused:', target.tagName, target.className);
        }
      }
    };

    const handleInputBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (isInputElement(target)) {
        isInputFocused = false;
        if (options.debugMode) {
          console.log('[SwipeGesture] Input blurred:', target.tagName, target.className);
        }
      }
    };

    // Setup keyboard and input listeners if keyboard-aware
    if (options.keyboardAware !== false) {
      window.addEventListener('keyboardOpen', handleKeyboardOpen as EventListener);
      window.addEventListener('keyboardClose', handleKeyboardClose);
      document.addEventListener('focusin', handleInputFocus);
      document.addEventListener('focusout', handleInputBlur);
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Store the original target that received the touch start event
      startTarget = e.target;
      
      // Enhanced input detection and keyboard awareness
      if (startTarget instanceof HTMLElement) {
        // Check if keyboard is visible and we should respect it
        if (options.keyboardAware !== false && (keyboardVisible || isInputFocused)) {
          if (options.debugMode) {
            console.log('[SwipeGesture] Blocked - keyboard visible or input focused');
          }
          return;
        }
        
        // Enhanced input element detection
        if (isInputElement(startTarget)) {
          if (options.debugMode) {
            console.log('[SwipeGesture] Blocked - input element detected:', startTarget.tagName, startTarget.className);
          }
          return;
        }
      }
      
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = true;
      
      if (options.debugMode) {
        console.log('[SwipeGesture] Touch start:', { x: touchStartX, y: touchStartY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping) return;
      
      // Additional keyboard awareness during move
      if (options.keyboardAware !== false && (keyboardVisible || isInputFocused)) {
        isSwiping = false;
        if (options.debugMode) {
          console.log('[SwipeGesture] Move blocked - keyboard state changed');
        }
        return;
      }
      
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping) return;
      
      // Reset the swiping state
      isSwiping = false;
      
      // Enhanced input detection for end event
      if (startTarget instanceof HTMLElement && isInputElement(startTarget)) {
        if (options.debugMode) {
          console.log('[SwipeGesture] End blocked - input element');
        }
        return;
      }
      
      // Final keyboard awareness check
      if (options.keyboardAware !== false && (keyboardVisible || isInputFocused)) {
        if (options.debugMode) {
          console.log('[SwipeGesture] End blocked - keyboard active');
        }
        return;
      }
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (options.debugMode) {
        console.log('[SwipeGesture] Touch end:', { 
          deltaX, 
          deltaY, 
          distance, 
          minDistance: minSwipeDistance,
          keyboardVisible,
          isInputFocused
        });
      }
      
      // Only handle horizontal or vertical swipes, not diagonal
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe detection
        if (Math.abs(deltaX) > minSwipeDistance) {
          if (deltaX > 0 && options.onSwipeRight) {
            if (options.debugMode) console.log('[SwipeGesture] Swipe right triggered');
            options.onSwipeRight();
          } else if (deltaX < 0 && options.onSwipeLeft) {
            if (options.debugMode) console.log('[SwipeGesture] Swipe left triggered');
            options.onSwipeLeft();
          }
        }
      } else {
        // Vertical swipe detection
        if (Math.abs(deltaY) > minSwipeDistance) {
          if (deltaY > 0 && options.onSwipeDown) {
            if (options.debugMode) console.log('[SwipeGesture] Swipe down triggered');
            options.onSwipeDown();
          } else if (deltaY < 0 && options.onSwipeUp) {
            if (options.debugMode) console.log('[SwipeGesture] Swipe up triggered');
            options.onSwipeUp();
          }
        }
      }
    };

    // Use passive listeners to avoid interfering with native scrolling/keyboard gestures
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      // Clean up keyboard and input listeners
      if (options.keyboardAware !== false) {
        window.removeEventListener('keyboardOpen', handleKeyboardOpen as EventListener);
        window.removeEventListener('keyboardClose', handleKeyboardClose);
        document.removeEventListener('focusin', handleInputFocus);
        document.removeEventListener('focusout', handleInputBlur);
      }
    };
  }, [elementRef, options]);
}
