
import { useEffect, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;  // New option to disable swipe detection
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

    const handleTouchStart = (e: TouchEvent) => {
      // Store the original target that received the touch start event
      startTarget = e.target;
      
      // Don't initiate swipe if touching an input, textarea or select field
      // Also check for contenteditable elements and elements with keyboard interaction
      if (
        startTarget instanceof HTMLElement && 
        (startTarget.tagName === 'INPUT' || 
         startTarget.tagName === 'TEXTAREA' || 
         startTarget.tagName === 'SELECT' ||
         startTarget.isContentEditable ||
         startTarget.closest('input, textarea, select, [contenteditable]'))
      ) {
        // Don't prevent default - let native keyboard gestures work
        return;
      }
      
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping) return;
      
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping) return;
      
      // Reset the swiping state
      isSwiping = false;
      
      // Don't process swipe if the start target was an input element
      if (
        startTarget instanceof HTMLElement && 
        (startTarget.tagName === 'INPUT' || 
         startTarget.tagName === 'TEXTAREA' || 
         startTarget.tagName === 'SELECT')
      ) {
        return;
      }
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Only handle horizontal or vertical swipes, not diagonal
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe detection
        if (Math.abs(deltaX) > minSwipeDistance) {
          if (deltaX > 0 && options.onSwipeRight) {
            options.onSwipeRight();
          } else if (deltaX < 0 && options.onSwipeLeft) {
            options.onSwipeLeft();
          }
        }
      } else {
        // Vertical swipe detection
        if (Math.abs(deltaY) > minSwipeDistance) {
          if (deltaY > 0 && options.onSwipeDown) {
            options.onSwipeDown();
          } else if (deltaY < 0 && options.onSwipeUp) {
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
    };
  }, [elementRef, options]);
}
