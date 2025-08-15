/**
 * Phase 3: Coordinated Swipe and Input Detection
 * Unifies swipe detection with input handling, prioritizing composition events
 */

import { useEffect, useRef, useCallback, RefObject } from 'react';
import { useEnhancedAndroidComposition } from './use-enhanced-android-composition';
import { useUnifiedTouchActionManager } from './use-unified-touch-action-manager';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface CoordinatedDetectionOptions {
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  enableSwipeDetection?: boolean;
  enableInputPriority?: boolean;
  minSwipeDistance?: number;
  swipeTimeoutMs?: number;
  debugMode?: boolean;
}

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface DetectionState {
  isInputActive: boolean;
  isComposing: boolean;
  hasActiveSwipe: boolean;
  swipeBlocked: boolean;
  inputBlocked: boolean;
  lastInteractionType: 'input' | 'swipe' | 'composition' | null;
}

export const useCoordinatedSwipeInputDetection = (
  elementRef: RefObject<HTMLElement>,
  swipeCallbacks: SwipeCallbacks,
  options: CoordinatedDetectionOptions = {}
) => {
  const { platform, isNative } = useEnhancedPlatformDetection();
  const touchActionManager = useUnifiedTouchActionManager({
    debugMode: options.debugMode
  });

  const {
    inputRef,
    enableSwipeDetection = true,
    enableInputPriority = true,
    minSwipeDistance = 50,
    swipeTimeoutMs = 300,
    debugMode = false
  } = options;

  // Android composition integration - only on Android to prevent circular dependencies
  const androidComposition = platform === 'android' && enableSwipeDetection ? 
    useEnhancedAndroidComposition(inputRef || { current: null }, {
      enableCapacitorIntegration: isNative,
      debugMode
    }) : {
      isAndroid: false,
      isComposing: false,
      hasSwipeGesture: false,
      compositionLength: 0,
      keyboardBrand: 'unknown',
      capacitorKeyboardHeight: 0
    };

  const detectionState = useRef<DetectionState>({
    isInputActive: false,
    isComposing: false,
    hasActiveSwipe: false,
    swipeBlocked: false,
    inputBlocked: false,
    lastInteractionType: null
  });

  const touchData = useRef({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    startTime: 0,
    startTarget: null as EventTarget | null
  });

  const touchActionId = useRef<string | null>(null);
  const swipeTimeoutRef = useRef<NodeJS.Timeout>();

  // Check if target is an input element
  const isInputElement = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    
    const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    return inputTags.includes(target.tagName) || 
           target.isContentEditable ||
           target.closest('input, textarea, select, [contenteditable]') !== null;
  }, []);

  // Update detection state
  const updateDetectionState = useCallback((updates: Partial<DetectionState>) => {
    const prevState = { ...detectionState.current };
    Object.assign(detectionState.current, updates);

    if (debugMode) {
      console.log('[CoordinatedDetection] State updated:', {
        previous: prevState,
        current: detectionState.current,
        platform,
        isNative
      });
    }

    // Dispatch state change event
    window.dispatchEvent(new CustomEvent('coordinatedDetectionStateChange', {
      detail: {
        previousState: prevState,
        currentState: detectionState.current,
        platform
      }
    }));
  }, [debugMode, platform, isNative]);

  // Handle input focus
  const handleInputFocus = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isInputElement(target)) return;

    updateDetectionState({
      isInputActive: true,
      lastInteractionType: 'input'
    });

    // Apply input-priority touch actions
    if (enableInputPriority && elementRef.current) {
      touchActionId.current = touchActionManager.setTouchAction(
        elementRef.current,
        'keyboard',
        'manipulation'
      );
    }

    if (debugMode) {
      console.log('[CoordinatedDetection] Input focused, swipe detection adjusted');
    }
  }, [isInputElement, updateDetectionState, enableInputPriority, elementRef, touchActionManager, debugMode]);

  // Handle input blur
  const handleInputBlur = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!isInputElement(target)) return;

    updateDetectionState({
      isInputActive: false,
      lastInteractionType: null
    });

    // Remove input-priority touch actions
    if (touchActionId.current) {
      touchActionManager.removeTouchAction(touchActionId.current);
      touchActionId.current = null;
    }

    if (debugMode) {
      console.log('[CoordinatedDetection] Input blurred, swipe detection restored');
    }
  }, [isInputElement, updateDetectionState, touchActionManager, debugMode]);

  // Handle composition events
  const handleCompositionStart = useCallback((e: CustomEvent) => {
    updateDetectionState({
      isComposing: true,
      swipeBlocked: true,
      lastInteractionType: 'composition'
    });

    if (debugMode) {
      console.log('[CoordinatedDetection] Composition started, swipes blocked');
    }
  }, [updateDetectionState, debugMode]);

  const handleCompositionEnd = useCallback((e: CustomEvent) => {
    updateDetectionState({
      isComposing: false,
      swipeBlocked: false,
      lastInteractionType: null
    });

    if (debugMode) {
      console.log('[CoordinatedDetection] Composition ended, swipes unblocked');
    }
  }, [updateDetectionState, debugMode]);

  // Coordinated touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enableSwipeDetection || !elementRef.current) return;

    const target = e.target;
    touchData.current.startTarget = target;
    touchData.current.startTime = Date.now();
    touchData.current.startX = e.touches[0].clientX;
    touchData.current.startY = e.touches[0].clientY;

    // Check if we should block swipe detection
    const shouldBlockSwipe = 
      detectionState.current.isComposing ||
      detectionState.current.swipeBlocked ||
      (enableInputPriority && detectionState.current.isInputActive && isInputElement(target));

    if (shouldBlockSwipe) {
      if (debugMode) {
        console.log('[CoordinatedDetection] Swipe blocked:', {
          isComposing: detectionState.current.isComposing,
          swipeBlocked: detectionState.current.swipeBlocked,
          isInputActive: detectionState.current.isInputActive,
          isInputElement: isInputElement(target)
        });
      }
      return;
    }

    updateDetectionState({
      hasActiveSwipe: true,
      lastInteractionType: 'swipe'
    });

    // Set swipe timeout
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
    }
    
    swipeTimeoutRef.current = setTimeout(() => {
      updateDetectionState({ hasActiveSwipe: false });
    }, swipeTimeoutMs);

    if (debugMode) {
      console.log('[CoordinatedDetection] Touch start registered for swipe');
    }
  }, [
    enableSwipeDetection,
    elementRef,
    updateDetectionState,
    enableInputPriority,
    isInputElement,
    swipeTimeoutMs,
    debugMode
  ]);

  // Coordinated touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!detectionState.current.hasActiveSwipe) return;

    touchData.current.endX = e.touches[0].clientX;
    touchData.current.endY = e.touches[0].clientY;

    // Check if input became active during swipe
    if (enableInputPriority && detectionState.current.isInputActive) {
      updateDetectionState({ hasActiveSwipe: false });
      if (debugMode) {
        console.log('[CoordinatedDetection] Swipe cancelled due to input activation');
      }
    }
  }, [updateDetectionState, enableInputPriority, debugMode]);

  // Coordinated touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!detectionState.current.hasActiveSwipe) return;

    updateDetectionState({ hasActiveSwipe: false });

    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
    }

    // Calculate swipe
    const deltaX = touchData.current.endX - touchData.current.startX;
    const deltaY = touchData.current.endY - touchData.current.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - touchData.current.startTime;

    if (distance < minSwipeDistance || duration > swipeTimeoutMs) {
      if (debugMode) {
        console.log('[CoordinatedDetection] Swipe not triggered:', { distance, duration, minSwipeDistance, swipeTimeoutMs });
      }
      return;
    }

    // Determine swipe direction and trigger callback
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    if (isHorizontal) {
      if (deltaX > 0 && swipeCallbacks.onSwipeRight) {
        swipeCallbacks.onSwipeRight();
        if (debugMode) console.log('[CoordinatedDetection] Swipe right triggered');
      } else if (deltaX < 0 && swipeCallbacks.onSwipeLeft) {
        swipeCallbacks.onSwipeLeft();
        if (debugMode) console.log('[CoordinatedDetection] Swipe left triggered');
      }
    } else {
      if (deltaY > 0 && swipeCallbacks.onSwipeDown) {
        swipeCallbacks.onSwipeDown();
        if (debugMode) console.log('[CoordinatedDetection] Swipe down triggered');
      } else if (deltaY < 0 && swipeCallbacks.onSwipeUp) {
        swipeCallbacks.onSwipeUp();
        if (debugMode) console.log('[CoordinatedDetection] Swipe up triggered');
      }
    }
  }, [swipeCallbacks, minSwipeDistance, swipeTimeoutMs, updateDetectionState, debugMode]);

  // Setup event listeners
  useEffect(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;

    // Touch events for swipe detection
    if (enableSwipeDetection) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Input focus/blur events
    document.addEventListener('focusin', handleInputFocus);
    document.addEventListener('focusout', handleInputBlur);

    // Composition events
    window.addEventListener('compositionStarted', handleCompositionStart as EventListener);
    window.addEventListener('compositionEnded', handleCompositionEnd as EventListener);
    window.addEventListener('androidCompositionStart', handleCompositionStart as EventListener);
    window.addEventListener('androidCompositionEnd', handleCompositionEnd as EventListener);

    return () => {
      if (enableSwipeDetection) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }

      document.removeEventListener('focusin', handleInputFocus);
      document.removeEventListener('focusout', handleInputBlur);

      window.removeEventListener('compositionStarted', handleCompositionStart as EventListener);
      window.removeEventListener('compositionEnded', handleCompositionEnd as EventListener);
      window.removeEventListener('androidCompositionStart', handleCompositionStart as EventListener);
      window.removeEventListener('androidCompositionEnd', handleCompositionEnd as EventListener);

      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }

      if (touchActionId.current) {
        touchActionManager.removeTouchAction(touchActionId.current);
      }
    };
  }, [
    elementRef,
    enableSwipeDetection,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleInputFocus,
    handleInputBlur,
    handleCompositionStart,
    handleCompositionEnd,
    touchActionManager
  ]);

  return {
    detectionState: detectionState.current,
    androidComposition,
    platform,
    isNative
  };
};