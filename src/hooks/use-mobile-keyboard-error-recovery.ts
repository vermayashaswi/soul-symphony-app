import { useEffect, useCallback } from 'react';
import { usePlatformDetection } from './use-platform-detection';

interface MobileKeyboardErrorRecoveryOptions {
  enableDebugMode?: boolean;
  autoRecovery?: boolean;
  recoveryDelay?: number;
}

interface KeyboardError {
  type: 'input_freeze' | 'swipe_conflict' | 'focus_lost' | 'keyboard_stuck' | 'unknown';
  element?: HTMLElement;
  timestamp: number;
  context?: string;
}

export const useMobileKeyboardErrorRecovery = (
  options: MobileKeyboardErrorRecoveryOptions = {}
) => {
  const { platform, isNative, isReady } = usePlatformDetection();
  const { enableDebugMode = false, autoRecovery = true, recoveryDelay = 1000 } = options;

  const logError = useCallback((error: KeyboardError) => {
    if (enableDebugMode) {
      console.warn('[KeyboardErrorRecovery] Error detected:', {
        type: error.type,
        element: error.element?.tagName,
        className: error.element?.className,
        context: error.context,
        platform,
        timestamp: new Date(error.timestamp).toISOString()
      });
    }
  }, [enableDebugMode, platform]);

  const recoverFromInputFreeze = useCallback((element?: HTMLElement) => {
    if (enableDebugMode) {
      console.log('[KeyboardErrorRecovery] Attempting input freeze recovery');
    }

    try {
      // Force blur and refocus to reset input state
      if (element && element instanceof HTMLInputElement) {
        element.blur();
        setTimeout(() => {
          element.focus();
          // Trigger input event to ensure predictive text works
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }, 100);
      }

      // Reset CSS touch policies
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
      
      setTimeout(() => {
        document.body.style.touchAction = 'manipulation';
        if (document.body.classList.contains('keyboard-visible')) {
          document.body.style.userSelect = 'text';
        }
      }, 200);

    } catch (error) {
      console.error('[KeyboardErrorRecovery] Input freeze recovery failed:', error);
    }
  }, [enableDebugMode]);

  const recoverFromSwipeConflict = useCallback(() => {
    if (enableDebugMode) {
      console.log('[KeyboardErrorRecovery] Attempting swipe conflict recovery');
    }

    try {
      // Temporarily disable swipe gestures
      window.dispatchEvent(new CustomEvent('disableSwipeGestures', { 
        detail: { duration: 2000 } 
      }));

      // Reset touch event handling
      const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
      inputs.forEach(input => {
        const element = input as HTMLElement;
        element.style.touchAction = 'manipulation';
        element.style.userSelect = 'text';
        element.style.webkitUserSelect = 'text';
      });

    } catch (error) {
      console.error('[KeyboardErrorRecovery] Swipe conflict recovery failed:', error);
    }
  }, [enableDebugMode]);

  const recoverFromKeyboardStuck = useCallback(() => {
    if (enableDebugMode) {
      console.log('[KeyboardErrorRecovery] Attempting keyboard stuck recovery');
    }

    try {
      // Force keyboard hide by blurring all inputs
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )) {
        activeElement.blur();
      }

      // Reset keyboard state
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--keyboard-height');
      
      // Dispatch keyboard close event
      window.dispatchEvent(new CustomEvent('keyboardClose', { 
        detail: { height: 0, isVisible: false, forced: true } 
      }));

    } catch (error) {
      console.error('[KeyboardErrorRecovery] Keyboard stuck recovery failed:', error);
    }
  }, [enableDebugMode]);

  const handleError = useCallback((error: KeyboardError) => {
    logError(error);

    if (!autoRecovery) return;

    setTimeout(() => {
      switch (error.type) {
        case 'input_freeze':
          recoverFromInputFreeze(error.element);
          break;
        case 'swipe_conflict':
          recoverFromSwipeConflict();
          break;
        case 'keyboard_stuck':
          recoverFromKeyboardStuck();
          break;
        case 'focus_lost':
          if (error.element) {
            setTimeout(() => {
              error.element?.focus();
            }, 100);
          }
          break;
        default:
          // General recovery
          recoverFromInputFreeze(error.element);
          recoverFromSwipeConflict();
      }
    }, recoveryDelay);
  }, [logError, autoRecovery, recoveryDelay, recoverFromInputFreeze, recoverFromSwipeConflict, recoverFromKeyboardStuck]);

  // Set up error detection
  useEffect(() => {
    if (!isReady) return;

    let inputFreezeTimer: NodeJS.Timeout;
    let lastInputTime = Date.now();
    let keyboardStuckTimer: NodeJS.Timeout;

    // Detect input freeze (no input events after focus)
    const handleInputFocus = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

      lastInputTime = Date.now();
      
      // Clear existing timer
      if (inputFreezeTimer) clearTimeout(inputFreezeTimer);
      
      // Set up freeze detection
      inputFreezeTimer = setTimeout(() => {
        const timeSinceLastInput = Date.now() - lastInputTime;
        if (timeSinceLastInput > 2000 && document.activeElement === target) {
          handleError({
            type: 'input_freeze',
            element: target,
            timestamp: Date.now(),
            context: 'No input detected after focus'
          });
        }
      }, 3000);
    };

    const handleInputEvent = () => {
      lastInputTime = Date.now();
    };

    // Detect keyboard stuck (keyboard visible but no active input)
    const handleKeyboardOpen = () => {
      keyboardStuckTimer = setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (!activeElement || !(
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        )) {
          handleError({
            type: 'keyboard_stuck',
            timestamp: Date.now(),
            context: 'Keyboard visible but no active input'
          });
        }
      }, 5000);
    };

    const handleKeyboardClose = () => {
      if (keyboardStuckTimer) {
        clearTimeout(keyboardStuckTimer);
      }
    };

    // Detect swipe conflicts (swipe gestures during input)
    const handleSwipeGesture = (e: CustomEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )) {
        handleError({
          type: 'swipe_conflict',
          element: activeElement,
          timestamp: Date.now(),
          context: `Swipe detected during input: ${e.type}`
        });
      }
    };

    // Set up event listeners
    document.addEventListener('focusin', handleInputFocus);
    document.addEventListener('input', handleInputEvent);
    window.addEventListener('keyboardOpen', handleKeyboardOpen);
    window.addEventListener('keyboardClose', handleKeyboardClose);
    
    // Listen to coordinated detection state changes (from swipe/input coordinator)
    const handleDetectionStateChange = (e: CustomEvent) => {
      const detail: any = e.detail || {};
      const hasActiveSwipe = !!detail.hasActiveSwipe;
      const isComposing = !!detail.isComposing;
      const inputActive = (() => {
        const ae = document.activeElement as HTMLElement | null;
        return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      })();

      if (hasActiveSwipe && (inputActive || isComposing)) {
        if (enableDebugMode) {
          console.log('[KeyboardErrorRecovery] Coordinated swipe conflict detected; applying silent recovery');
        }
        // Silent recovery without escalating to global error handler
        recoverFromSwipeConflict();
      }
    };

    window.addEventListener('coordinatedDetectionStateChange', handleDetectionStateChange as EventListener);

    // Manual error reporting
    (window as any).reportKeyboardError = (type: string, context?: string) => {
      handleError({
        type: type as KeyboardError['type'],
        element: document.activeElement as HTMLElement,
        timestamp: Date.now(),
        context: context || 'Manual report'
      });
    };

    return () => {
      if (inputFreezeTimer) clearTimeout(inputFreezeTimer);
      if (keyboardStuckTimer) clearTimeout(keyboardStuckTimer);
      
      document.removeEventListener('focusin', handleInputFocus);
      document.removeEventListener('input', handleInputEvent);
      window.removeEventListener('keyboardOpen', handleKeyboardOpen);
      window.removeEventListener('keyboardClose', handleKeyboardClose);
      
      window.removeEventListener('coordinatedDetectionStateChange', handleDetectionStateChange as EventListener);
    };
  }, [isReady, handleError]);

  return {
    handleError,
    recoverFromInputFreeze,
    recoverFromSwipeConflict,
    recoverFromKeyboardStuck,
    platform,
    isNative,
    isReady
  };
};