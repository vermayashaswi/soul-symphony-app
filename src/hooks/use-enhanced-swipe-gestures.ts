import { useRef, useEffect, useCallback } from 'react';
import { useEnvironmentDetection } from './use-environment-detection';
import { useUnifiedKeyboard } from './use-unified-keyboard';

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
 * Enhanced swipe gestures with environment-aware keyboard coordination
 */
export const useEnhancedSwipeGestures = (options: SwipeGestureOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
    disabled = false
  } = options;

  const touchStartRef = useRef<TouchPoint | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  
  const { isCapacitorWebView, isMobileBrowser } = useEnvironmentDetection();
  const { isKeyboardVisible } = useUnifiedKeyboard();

  const shouldBlockSwipe = useCallback((target: EventTarget | null): boolean => {
    if (disabled) return true;

    // Always block swipes when keyboard is visible and input is focused
    if (isKeyboardVisible) {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return true;
      }
    }

    // Block on interactive elements
    if (target && target instanceof HTMLElement) {
      const tagName = target.tagName.toLowerCase();
      const isInteractive = [
        'input', 'textarea', 'button', 'select', 'a'
      ].includes(tagName);
      
      const hasClickHandler = target.onclick || 
        target.getAttribute('role') === 'button' ||
        target.classList.contains('cursor-pointer');
      
      if (isInteractive || hasClickHandler) {
        return true;
      }

      // Check parent elements for interactive behavior
      let parent = target.parentElement;
      let depth = 0;
      while (parent && depth < 3) {
        if (parent.onclick || parent.classList.contains('cursor-pointer')) {
          return true;
        }
        parent = parent.parentElement;
        depth++;
      }
    }

    return false;
  }, [disabled, isKeyboardVisible]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (shouldBlockSwipe(e.target)) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now()
      };
    }
  }, [shouldBlockSwipe]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current || shouldBlockSwipe(e.target)) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }

    const endPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    const deltaX = endPoint.x - touchStartRef.current.x;
    const deltaY = endPoint.y - touchStartRef.current.y;
    const deltaTime = endPoint.timestamp - touchStartRef.current.timestamp;

    // Calculate distance and velocity
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime;

    // Require minimum distance and reasonable velocity
    if (distance < minDistance || deltaTime > 500 || velocity < 0.1) {
      touchStartRef.current = null;
      return;
    }

    // Determine swipe direction
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    let swipeHandled = false;

    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (deltaX > 0 && onSwipeRight) {
        console.log('[EnhancedSwipeGestures] Swipe right detected');
        onSwipeRight();
        swipeHandled = true;
      } else if (deltaX < 0 && onSwipeLeft) {
        console.log('[EnhancedSwipeGestures] Swipe left detected');
        onSwipeLeft();
        swipeHandled = true;
      }
    } else {
      // Vertical swipe
      if (deltaY > 0 && onSwipeDown) {
        console.log('[EnhancedSwipeGestures] Swipe down detected');
        onSwipeDown();
        swipeHandled = true;
      } else if (deltaY < 0 && onSwipeUp) {
        console.log('[EnhancedSwipeGestures] Swipe up detected');
        onSwipeUp();
        swipeHandled = true;
      }
    }

    if (swipeHandled) {
      e.preventDefault();
      e.stopPropagation();
    }

    touchStartRef.current = null;
  }, [shouldBlockSwipe, minDistance, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || disabled) return;

    console.log('[EnhancedSwipeGestures] Setting up swipe detection for environment:', {
      isCapacitorWebView,
      isMobileBrowser
    });

    // Use passive listeners for better performance
    const options = { passive: false };
    
    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd, disabled, isCapacitorWebView, isMobileBrowser]);

  return elementRef;
};