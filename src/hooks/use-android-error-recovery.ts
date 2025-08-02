import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface AndroidErrorRecoveryOptions {
  enableAutoRecovery?: boolean;
  enableGestureConflictDetection?: boolean;
  enableMemoryOptimization?: boolean;
  recoveryDelay?: number;
  debugMode?: boolean;
}

interface AndroidKeyboardError {
  type: 'android_keyboard_freeze' | 'android_gesture_conflict' | 'android_memory_issue' | 'android_webview_crash';
  element?: HTMLElement;
  timestamp: number;
  context: string;
  androidVersion?: string;
  webViewVersion?: string;
  keyboardType?: string;
}

export const useAndroidErrorRecovery = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: AndroidErrorRecoveryOptions = {}
) => {
  const { platform, androidVersion, webViewVersion, keyboardType } = useEnhancedPlatformDetection();
  const {
    enableAutoRecovery = true,
    enableGestureConflictDetection = true,
    enableMemoryOptimization = true,
    recoveryDelay = 500,
    debugMode = false
  } = options;

  const errorCount = useRef(0);
  const lastErrorTime = useRef(0);
  const recoveryAttempts = useRef<Map<string, number>>(new Map());

  // Skip if not Android
  if (platform !== 'android') {
    return { isAndroid: false, handleError: () => {}, recoverFromError: () => {} };
  }

  const logError = useCallback((error: AndroidKeyboardError) => {
    if (debugMode) {
      console.error('[AndroidErrorRecovery] Error detected:', error);
    }
    errorCount.current++;
    lastErrorTime.current = error.timestamp;
  }, [debugMode]);

  // Recover from Android keyboard freeze
  const recoverFromKeyboardFreeze = useCallback((element?: HTMLElement) => {
    const target = element || inputRef.current;
    if (!target) return;

    try {
      // Method 1: Force keyboard re-engagement
      target.blur();
      setTimeout(() => {
        target.focus();
        
        // Android-specific keyboard trigger
        if (keyboardType === 'samsung') {
          // Samsung keyboards sometimes need a double-tap
          target.click();
          setTimeout(() => target.click(), 100);
        } else if (keyboardType === 'gboard') {
          // GBoard responds better to programmatic input
          target.dispatchEvent(new Event('touchstart', { bubbles: true }));
          target.dispatchEvent(new Event('touchend', { bubbles: true }));
        }
      }, 100);

      // Method 2: Reset IME state
      setTimeout(() => {
        (target.style as any).imeMode = 'inactive';
        setTimeout(() => {
          (target.style as any).imeMode = 'active';
        }, 50);
      }, 200);

      // Method 3: WebView refresh for severe cases
      if (recoveryAttempts.current.get('keyboard_freeze') || 0 >= 3) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

      if (debugMode) {
        console.log('[AndroidErrorRecovery] Keyboard freeze recovery applied');
      }
    } catch (error) {
      console.error('[AndroidErrorRecovery] Recovery failed:', error);
    }
  }, [inputRef, keyboardType, debugMode, recoveryAttempts]);

  // Recover from gesture conflicts
  const recoverFromGestureConflict = useCallback(() => {
    try {
      // Disable all gesture handlers temporarily
      window.dispatchEvent(new CustomEvent('disableAndroidGestures', {
        detail: { duration: 2000 }
      }));

      // Reset touch states on all inputs
      document.querySelectorAll('input, textarea').forEach((input) => {
        const element = input as HTMLElement;
        element.style.touchAction = 'manipulation';
        element.style.userSelect = 'text';
        element.style.webkitUserSelect = 'text';
        (element.style as any).webkitTouchCallout = 'none';
      });

      // Clear any stuck touch events
      document.body.style.touchAction = 'manipulation';
      
      if (debugMode) {
        console.log('[AndroidErrorRecovery] Gesture conflict recovery applied');
      }
    } catch (error) {
      console.error('[AndroidErrorRecovery] Gesture conflict recovery failed:', error);
    }
  }, [debugMode]);

  // Recover from memory issues
  const recoverFromMemoryIssue = useCallback(() => {
    try {
      // Clear caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('temp') || name.includes('cache')) {
              caches.delete(name);
            }
          });
        });
      }

      // Reduce visual complexity
      document.body.classList.add('low-memory-mode');
      
      // Disable animations temporarily
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      `;
      style.id = 'android-memory-recovery';
      document.head.appendChild(style);

      // Remove after 10 seconds
      setTimeout(() => {
        document.body.classList.remove('low-memory-mode');
        const recoveryStyle = document.getElementById('android-memory-recovery');
        if (recoveryStyle) {
          recoveryStyle.remove();
        }
      }, 10000);

      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }

      if (debugMode) {
        console.log('[AndroidErrorRecovery] Memory issue recovery applied');
      }
    } catch (error) {
      console.error('[AndroidErrorRecovery] Memory recovery failed:', error);
    }
  }, [debugMode]);

  // Recover from WebView crashes
  const recoverFromWebViewCrash = useCallback(() => {
    try {
      // Store current state
      const currentValue = inputRef.current?.value || '';
      sessionStorage.setItem('android-recovery-input-value', currentValue);
      sessionStorage.setItem('android-recovery-timestamp', Date.now().toString());

      // Trigger controlled reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);

      if (debugMode) {
        console.log('[AndroidErrorRecovery] WebView crash recovery initiated');
      }
    } catch (error) {
      console.error('[AndroidErrorRecovery] WebView crash recovery failed:', error);
    }
  }, [inputRef, debugMode]);

  // Main error handler
  const handleError = useCallback((error: AndroidKeyboardError) => {
    logError(error);

    if (!enableAutoRecovery) return;

    const attemptKey = error.type;
    const currentAttempts = recoveryAttempts.current.get(attemptKey) || 0;
    recoveryAttempts.current.set(attemptKey, currentAttempts + 1);

    // Apply recovery with delay
    setTimeout(() => {
      switch (error.type) {
        case 'android_keyboard_freeze':
          recoverFromKeyboardFreeze(error.element);
          break;
        case 'android_gesture_conflict':
          recoverFromGestureConflict();
          break;
        case 'android_memory_issue':
          recoverFromMemoryIssue();
          break;
        case 'android_webview_crash':
          recoverFromWebViewCrash();
          break;
      }
    }, recoveryDelay);
  }, [
    logError,
    enableAutoRecovery,
    recoveryDelay,
    recoverFromKeyboardFreeze,
    recoverFromGestureConflict,
    recoverFromMemoryIssue,
    recoverFromWebViewCrash
  ]);

  // Error detection setup
  useEffect(() => {
    if (platform !== 'android') return;

    let keyboardFreezeDetection: NodeJS.Timeout;
    let memoryMonitoring: NodeJS.Timeout;
    let gestureConflictDetection: NodeJS.Timeout;

    // Keyboard freeze detection
    if (inputRef.current) {
      const element = inputRef.current;
      let lastInputTime = 0;
      let inputEventCount = 0;

      const checkKeyboardFreeze = () => {
        const now = Date.now();
        if (document.activeElement === element && now - lastInputTime > 5000 && inputEventCount === 0) {
          handleError({
            type: 'android_keyboard_freeze',
            element,
            timestamp: now,
            context: 'No input events for 5 seconds while focused',
            androidVersion,
            webViewVersion,
            keyboardType
          });
        }
      };

      const trackInput = () => {
        lastInputTime = Date.now();
        inputEventCount++;
      };

      element.addEventListener('input', trackInput);
      element.addEventListener('focus', () => {
        lastInputTime = Date.now();
        inputEventCount = 0;
        keyboardFreezeDetection = setInterval(checkKeyboardFreeze, 5000);
      });
      element.addEventListener('blur', () => {
        if (keyboardFreezeDetection) {
          clearInterval(keyboardFreezeDetection);
        }
      });
    }

    // Memory monitoring
    if (enableMemoryOptimization && 'memory' in performance) {
      memoryMonitoring = setInterval(() => {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;

        if (memoryUsage > 0.9) {
          handleError({
            type: 'android_memory_issue',
            timestamp: Date.now(),
            context: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
            androidVersion,
            webViewVersion
          });
        }
      }, 10000);
    }

    // Gesture conflict detection
    if (enableGestureConflictDetection) {
      let gestureStartTime = 0;
      let inputActiveTime = 0;

      const handleGestureStart = () => {
        gestureStartTime = Date.now();
      };

      const handleInputFocus = () => {
        inputActiveTime = Date.now();
      };

      const checkGestureConflict = () => {
        if (gestureStartTime > 0 && inputActiveTime > 0) {
          const timeDiff = Math.abs(gestureStartTime - inputActiveTime);
          if (timeDiff < 500) { // Conflict if within 500ms
            handleError({
              type: 'android_gesture_conflict',
              timestamp: Date.now(),
              context: 'Gesture and input events occurred simultaneously',
              androidVersion,
              webViewVersion,
              keyboardType
            });
          }
        }
      };

      window.addEventListener('touchstart', handleGestureStart);
      window.addEventListener('enhancedInputFocus', handleInputFocus as EventListener);
      gestureConflictDetection = setInterval(checkGestureConflict, 1000);
    }

    // Check for previous recovery state
    const recoveryValue = sessionStorage.getItem('android-recovery-input-value');
    const recoveryTimestamp = sessionStorage.getItem('android-recovery-timestamp');
    
    if (recoveryValue && recoveryTimestamp) {
      const timeDiff = Date.now() - parseInt(recoveryTimestamp, 10);
      if (timeDiff < 30000 && inputRef.current) { // Within 30 seconds
        inputRef.current.value = recoveryValue;
        sessionStorage.removeItem('android-recovery-input-value');
        sessionStorage.removeItem('android-recovery-timestamp');
        
        if (debugMode) {
          console.log('[AndroidErrorRecovery] Restored input value after recovery');
        }
      }
    }

    return () => {
      if (keyboardFreezeDetection) clearInterval(keyboardFreezeDetection);
      if (memoryMonitoring) clearInterval(memoryMonitoring);
      if (gestureConflictDetection) clearInterval(gestureConflictDetection);
    };
  }, [
    platform,
    inputRef,
    handleError,
    enableMemoryOptimization,
    enableGestureConflictDetection,
    androidVersion,
    webViewVersion,
    keyboardType,
    debugMode
  ]);

  return {
    isAndroid: true,
    handleError,
    recoverFromKeyboardFreeze,
    recoverFromGestureConflict,
    recoverFromMemoryIssue,
    recoverFromWebViewCrash,
    errorCount: errorCount.current,
    lastErrorTime: lastErrorTime.current
  };
};