
import { useEffect, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
}

export function useSwipeGesture(
  elementRef: RefObject<HTMLElement>,
  options: SwipeOptions
) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = options.minDistance || 50;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
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

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, options]);
}
