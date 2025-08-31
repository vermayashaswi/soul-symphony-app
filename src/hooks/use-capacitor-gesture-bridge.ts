import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { usePlatformDetection } from './use-platform-detection';

interface GestureBridgeOptions {
  elementRef: React.RefObject<HTMLElement>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;
  debugMode?: boolean;
}

interface TouchData {
  startX: number;
  startY: number;
  startTime: number;
  endX?: number;
  endY?: number;
  endTime?: number;
}

/**
 * Advanced Capacitor gesture bridge that handles WebView-specific touch events
 * and coordinates with native keyboard events for optimal gesture detection
 */
export const useCapacitorGestureBridge = (options: GestureBridgeOptions) => {
  const {
    elementRef,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
    disabled = false,
    debugMode = false
  } = options;

  const { platform, isNative } = usePlatformDetection();
  const touchDataRef = useRef<TouchData | null>(null);
  const isKeyboardVisibleRef = useRef(false);
  const gestureBlockedRef = useRef(false);
  const webViewMetricsRef = useRef({
    viewportHeight: window.innerHeight,
    visualViewportHeight: window.visualViewport?.height || window.innerHeight,
    keyboardHeight: 0
  });

  // Enhanced keyboard event handling for Capacitor
  useEffect(() => {
    if (!isNative) return;

    const keyboardWillShow = (info: KeyboardInfo) => {
      isKeyboardVisibleRef.current = true;
      webViewMetricsRef.current.keyboardHeight = info.keyboardHeight;
      gestureBlockedRef.current = true;
      
      if (debugMode) {
        console.log('[CapacitorGestureBridge] Keyboard will show:', info);
      }
      
      // Apply WebView-specific optimizations
      const element = elementRef.current;
      if (element) {
        element.style.setProperty('--capacitor-keyboard-height', `${info.keyboardHeight}px`);
        element.classList.add('capacitor-keyboard-visible');
      }
    };

    const keyboardDidShow = (info: KeyboardInfo) => {
      // Small delay to allow for WebView adjustment
      setTimeout(() => {
        gestureBlockedRef.current = false;
        if (debugMode) {
          console.log('[CapacitorGestureBridge] Keyboard fully shown, gestures re-enabled');
        }
      }, 150);
    };

    const keyboardWillHide = () => {
      gestureBlockedRef.current = true;
      if (debugMode) {
        console.log('[CapacitorGestureBridge] Keyboard will hide, blocking gestures');
      }
    };

    const keyboardDidHide = () => {
      isKeyboardVisibleRef.current = false;
      webViewMetricsRef.current.keyboardHeight = 0;
      gestureBlockedRef.current = false;
      
      const element = elementRef.current;
      if (element) {
        element.style.removeProperty('--capacitor-keyboard-height');
        element.classList.remove('capacitor-keyboard-visible');
      }
      
      if (debugMode) {
        console.log('[CapacitorGestureBridge] Keyboard hidden, gestures re-enabled');
      }
    };

    // Register Capacitor keyboard listeners
    Keyboard.addListener('keyboardWillShow', keyboardWillShow);
    Keyboard.addListener('keyboardDidShow', keyboardDidShow);
    Keyboard.addListener('keyboardWillHide', keyboardWillHide);
    Keyboard.addListener('keyboardDidHide', keyboardDidHide);

    return () => {
      Keyboard.removeAllListeners();
    };
  }, [isNative, debugMode, elementRef]);

  // WebView coordinate translation for Capacitor
  const translateWebViewCoordinates = useCallback((x: number, y: number) => {
    if (!isNative) return { x, y };

    const metrics = webViewMetricsRef.current;
    const statusBarHeight = Capacitor.isPluginAvailable('StatusBar') ? 24 : 0; // Estimate
    
    return {
      x,
      y: y - statusBarHeight // Adjust for status bar in native WebView
    };
  }, [isNative]);

  // Enhanced touch event handlers with Capacitor-specific logic
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || gestureBlockedRef.current) {
      if (debugMode) {
        console.log('[CapacitorGestureBridge] Touch blocked:', { disabled, gestureBlocked: gestureBlockedRef.current });
      }
      return;
    }

    // Check if touch is on input elements when keyboard is visible
    const target = e.target as Element;
    const isInputElement = target && (
      ['INPUT', 'TEXTAREA'].includes(target.tagName) ||
      target.getAttribute('contenteditable') === 'true' ||
      target.closest('input, textarea, [contenteditable="true"]')
    );

    if (isKeyboardVisibleRef.current && isInputElement) {
      if (debugMode) {
        console.log('[CapacitorGestureBridge] Touch blocked on input while keyboard visible');
      }
      return;
    }

    const touch = e.touches[0];
    const translated = translateWebViewCoordinates(touch.clientX, touch.clientY);
    
    touchDataRef.current = {
      startX: translated.x,
      startY: translated.y,
      startTime: Date.now()
    };

    if (debugMode) {
      console.log('[CapacitorGestureBridge] Touch start:', touchDataRef.current);
    }
  }, [disabled, debugMode, translateWebViewCoordinates]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (disabled || gestureBlockedRef.current || !touchDataRef.current) {
      touchDataRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const translated = translateWebViewCoordinates(touch.clientX, touch.clientY);
    const touchData = touchDataRef.current;
    
    const deltaX = translated.x - touchData.startX;
    const deltaY = translated.y - touchData.startY;
    const deltaTime = Date.now() - touchData.startTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Enhanced gesture detection for WebView
    const isValidSwipe = distance >= minDistance && deltaTime < 500; // Slightly longer for WebView
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (debugMode) {
      console.log('[CapacitorGestureBridge] Touch end:', {
        deltaX,
        deltaY,
        distance,
        deltaTime,
        isValidSwipe,
        isHorizontal,
        keyboardVisible: isKeyboardVisibleRef.current
      });
    }

    if (isValidSwipe) {
      // Prevent default behavior for recognized swipes in WebView
      e.preventDefault();
      
      if (isHorizontal) {
        if (deltaX > 0) {
          onSwipeRight?.();
          if (debugMode) console.log('[CapacitorGestureBridge] Swipe right executed');
        } else {
          onSwipeLeft?.();
          if (debugMode) console.log('[CapacitorGestureBridge] Swipe left executed');
        }
      } else {
        if (deltaY > 0) {
          onSwipeDown?.();
          if (debugMode) console.log('[CapacitorGestureBridge] Swipe down executed');
        } else {
          onSwipeUp?.();
          if (debugMode) console.log('[CapacitorGestureBridge] Swipe up executed');
        }
      }
    }

    touchDataRef.current = null;
  }, [disabled, debugMode, translateWebViewCoordinates, minDistance, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  // Attach event listeners with passive: false for WebView
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !isNative) return;

    const options = { passive: false }; // Allow preventDefault in WebView
    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd, isNative]);

  return {
    isCapacitorNative: isNative,
    isKeyboardVisible: isKeyboardVisibleRef.current,
    gestureBlocked: gestureBlockedRef.current,
    webViewMetrics: webViewMetricsRef.current
  };
};