import { useRef, useEffect, useCallback } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Chat-specific swipe gesture hook optimized for mobile chat interfaces
 * Handles swipe gestures while respecting keyboard states and input focus
 */
export const useChatSwipeGestures = (options: SwipeGestureOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
    disabled = false
  } = options;

  const touchStartRef = useRef<TouchPoint | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const shouldBlockSwipe = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;

    // Block swipes on input elements
    const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
    const isContentEditable = target.getAttribute('contenteditable') === 'true';
    
    // Block swipes on interactive elements
    const isInteractive = target.closest('button, a, select, [role="button"]');
    
    // Block swipes when keyboard is visible and target is input-related
    const isKeyboardVisible = document.querySelector('.mobile-chat-input-container.keyboard-visible');
    const isInputContainer = target.closest('.mobile-chat-input-container');
    
    if (isKeyboardVisible && isInputContainer) {
      console.log('[ChatSwipeGestures] Blocking swipe - keyboard visible on input');
      return true;
    }

    if (isInput || isContentEditable || isInteractive) {
      console.log('[ChatSwipeGestures] Blocking swipe - interactive element');
      return true;
    }

    return false;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || shouldBlockSwipe(e.target)) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    console.log('[ChatSwipeGestures] Touch start:', touchStartRef.current);
  }, [disabled, shouldBlockSwipe]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (disabled || !touchStartRef.current || shouldBlockSwipe(e.target)) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = touchEnd.y - touchStartRef.current.y;
    const deltaTime = touchEnd.timestamp - touchStartRef.current.timestamp;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const isQuickSwipe = deltaTime < 300; // Quick swipe within 300ms

    console.log('[ChatSwipeGestures] Touch end:', {
      deltaX,
      deltaY,
      distance,
      deltaTime,
      minDistance,
      isQuickSwipe
    });

    // Only process swipes that meet minimum distance and are reasonably quick
    if (distance >= minDistance && isQuickSwipe) {
      // Determine primary direction
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      
      if (isHorizontal) {
        if (deltaX > 0) {
          console.log('[ChatSwipeGestures] Swipe right detected');
          onSwipeRight?.();
        } else {
          console.log('[ChatSwipeGestures] Swipe left detected');
          onSwipeLeft?.();
        }
      } else {
        if (deltaY > 0) {
          console.log('[ChatSwipeGestures] Swipe down detected');
          onSwipeDown?.();
        } else {
          console.log('[ChatSwipeGestures] Swipe up detected');
          onSwipeUp?.();
        }
      }
    }

    touchStartRef.current = null;
  }, [disabled, shouldBlockSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, minDistance]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const options = { passive: true };
    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return elementRef;
};