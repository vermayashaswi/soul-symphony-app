import { useEffect, RefObject, useState } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;
  keyboardAware?: boolean;
  debugMode?: boolean;
}

export function useSwipeGesture(
  elementRef: RefObject<HTMLElement>,
  options: SwipeOptions
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || options.disabled) return;

    const minSwipeDistance = options.minDistance || 50;

    const isInputElement = (target: HTMLElement): boolean => {
      const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      if (inputTags.includes(target.tagName)) return true;
      if (target.isContentEditable) return true;
      
      const role = target.getAttribute('role');
      if (role && ['textbox', 'searchbox', 'combobox'].includes(role)) return true;
      
      return false;
    };

    const shouldBlockSwipe = (): boolean => {
      // Block if disabled
      if (options.disabled) return true;

      // Block if keyboard is visible - check both legacy and new class names
      const isKeyboardVisible = document.body.classList.contains('keyboard-visible') || 
                                document.body.classList.contains('capacitor-keyboard-visible');
      
      if (options.keyboardAware && isKeyboardVisible) {
        if (options.debugMode) {
          console.log('[SwipeGesture] Blocked - keyboard visible');
        }
        return true;
      }

      // Block if input is focused
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && isInputElement(activeElement)) {
        if (options.debugMode) {
          console.log('[SwipeGesture] Blocked - input focused');
        }
        return true;
      }

      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (shouldBlockSwipe()) return;

      const touch = e.touches[0];
      setTouchStart({
        x: touch.clientX,
        y: touch.clientY
      });

      if (options.debugMode) {
        console.log('[SwipeGesture] Touch start:', { x: touch.clientX, y: touch.clientY });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart || shouldBlockSwipe()) {
        setTouchStart(null);
        return;
      }

      const touch = e.changedTouches[0];
      const touchEnd = {
        x: touch.clientX,
        y: touch.clientY
      };

      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (options.debugMode) {
        console.log('[SwipeGesture] Touch end:', {
          start: touchStart,
          end: touchEnd,
          deltaX,
          deltaY,
          absDeltaX,
          absDeltaY,
          minDistance: minSwipeDistance
        });
      }

      // Determine swipe direction
      if (absDeltaX > minSwipeDistance || absDeltaY > minSwipeDistance) {
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          if (deltaX > 0) {
            options.onSwipeRight?.();
            if (options.debugMode) console.log('[SwipeGesture] Swipe right detected');
          } else {
            options.onSwipeLeft?.();
            if (options.debugMode) console.log('[SwipeGesture] Swipe left detected');
          }
        } else {
          // Vertical swipe
          if (deltaY > 0) {
            options.onSwipeDown?.();
            if (options.debugMode) console.log('[SwipeGesture] Swipe down detected');
          } else {
            options.onSwipeUp?.();
            if (options.debugMode) console.log('[SwipeGesture] Swipe up detected');
          }
        }
      }

      setTouchStart(null);
    };

    const handleTouchCancel = () => {
      setTouchStart(null);
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [elementRef, options, touchStart]);
}