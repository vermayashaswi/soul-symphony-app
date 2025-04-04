
import { useCallback, useEffect, useRef, useState } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export function useSwipeGesture(ref: React.RefObject<HTMLElement>, options: SwipeOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50
  } = options;

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  
  // Store whether custom handlers were triggered
  const [handlerTriggered, setHandlerTriggered] = useState(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setHandlerTriggered(false);
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Only trigger if the horizontal swipe is greater than the vertical to avoid
    // conflicts with scrolling
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    
    // Handle horizontal swipes
    if (isHorizontalSwipe) {
      if (deltaX > threshold && onSwipeRight) {
        onSwipeRight();
        setHandlerTriggered(true);
      } else if (deltaX < -threshold && onSwipeLeft) {
        onSwipeLeft();
        setHandlerTriggered(true);
      }
    } 
    // Handle vertical swipes
    else {
      if (deltaY > threshold && onSwipeDown) {
        onSwipeDown();
        setHandlerTriggered(true);
      } else if (deltaY < -threshold && onSwipeUp) {
        onSwipeUp();
        setHandlerTriggered(true);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, handleTouchStart, handleTouchEnd]);
}
