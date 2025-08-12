/**
 * Phase 2: Enhanced Android Composition Handling
 * Improves composition event handling for swipe keyboards with Capacitor optimizations
 */

import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';
import { useUnifiedTouchActionManager } from './use-unified-touch-action-manager';

interface AndroidCompositionOptions {
  enableGboardOptimization?: boolean;
  enableSamsungOptimization?: boolean;
  enableSwypeOptimization?: boolean;
  enableCapacitorIntegration?: boolean;
  debugMode?: boolean;
}

interface AndroidCompositionState {
  isComposing: boolean;
  hasSwipeGesture: boolean;
  compositionLength: number;
  keyboardBrand: string;
  capacitorKeyboardHeight: number;
}

export const useEnhancedAndroidComposition = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: AndroidCompositionOptions = {}
) => {
  const { 
    platform, 
    keyboardType, 
    androidVersion, 
    webViewVersion,
    hasCompositionSupport 
  } = useEnhancedPlatformDetection();
  
  const touchActionManager = useUnifiedTouchActionManager({
    debugMode: options.debugMode,
    respectCapacitorNative: options.enableCapacitorIntegration
  });

  const {
    enableGboardOptimization = true,
    enableSamsungOptimization = true,
    enableSwypeOptimization = true,
    enableCapacitorIntegration = true,
    debugMode = false
  } = options;

  const compositionState = useRef<AndroidCompositionState>({
    isComposing: false,
    hasSwipeGesture: false,
    compositionLength: 0,
    keyboardBrand: keyboardType || 'unknown',
    capacitorKeyboardHeight: 0
  });

  const touchActionId = useRef<string | null>(null);
  const compositionTimers = useRef<Set<NodeJS.Timeout>>(new Set());

  // Skip if not Android
  if (platform !== 'android') {
    return {
      isAndroid: false,
      isComposing: false,
      hasSwipeGesture: false,
      keyboardBrand: 'unknown'
    };
  }

  // Capacitor keyboard integration
  const handleCapacitorKeyboard = useCallback(async () => {
    if (!enableCapacitorIntegration || !(window as any).Capacitor?.isNative) return;

    try {
      // Check if Capacitor Keyboard plugin is available
      if ((window as any).Capacitor?.Plugins?.Keyboard) {
        const keyboard = (window as any).Capacitor.Plugins.Keyboard;
        
        // Listen for keyboard events
        await keyboard.addListener('keyboardWillShow', (info) => {
          compositionState.current.capacitorKeyboardHeight = info.keyboardHeight;
          
          if (debugMode) {
            console.log('[AndroidComposition] Capacitor keyboard will show:', info);
          }
          
          // Apply Capacitor-specific optimizations
          if (inputRef.current) {
            touchActionId.current = touchActionManager.optimizeForAndroidKeyboard(inputRef.current);
          }
        });

        await keyboard.addListener('keyboardDidHide', () => {
          compositionState.current.capacitorKeyboardHeight = 0;
          
          if (touchActionId.current) {
            touchActionManager.removeTouchAction(touchActionId.current);
            touchActionId.current = null;
          }
          
          if (debugMode) {
            console.log('[AndroidComposition] Capacitor keyboard hidden');
          }
        });
      }
    } catch (error) {
      if (debugMode) {
        console.warn('[AndroidComposition] Capacitor keyboard integration failed:', error);
      }
    }
  }, [enableCapacitorIntegration, inputRef, touchActionManager, debugMode]);

  // Gboard-specific optimizations
  const optimizeForGboard = useCallback((element: HTMLInputElement | HTMLTextAreaElement) => {
    if (!enableGboardOptimization || keyboardType !== 'gboard') return;

    // Gboard swipe optimization
    (element.style as any).imeMode = 'active';
    element.setAttribute('inputmode', 'text');
    element.setAttribute('autocomplete', 'on');
    element.setAttribute('autocorrect', 'on');
    
    // Gboard-specific touch handling
    (element.style as any).webkitTouchCallout = 'none';
    element.style.webkitUserSelect = 'text';
    
    // Prevent interference with Gboard's gesture system
    element.style.touchAction = 'manipulation';
    
    if (debugMode) {
      console.log('[AndroidComposition] Gboard optimizations applied');
    }
  }, [enableGboardOptimization, keyboardType, debugMode]);

  // Samsung Keyboard optimizations
  const optimizeForSamsung = useCallback((element: HTMLInputElement | HTMLTextAreaElement) => {
    if (!enableSamsungOptimization || keyboardType !== 'samsung') return;

    // Samsung keyboard tends to work better with minimal touch interference
    element.style.touchAction = 'manipulation';
    element.style.userSelect = 'text';
    
    // Samsung-specific IME settings
    (element.style as any).imeMode = 'auto';
    element.setAttribute('autocomplete', 'on');
    
    if (debugMode) {
      console.log('[AndroidComposition] Samsung keyboard optimizations applied');
    }
  }, [enableSamsungOptimization, keyboardType, debugMode]);

  // Swype keyboard optimizations
  const optimizeForSwype = useCallback((element: HTMLInputElement | HTMLTextAreaElement) => {
    if (!enableSwypeOptimization || keyboardType !== 'swype') return;

    // Swype needs special gesture handling
    element.style.touchAction = 'manipulation';
    element.style.userSelect = 'text';
    element.style.webkitUserSelect = 'text';
    
    // Enhanced composition support for Swype
    (element.style as any).imeMode = 'active';
    element.setAttribute('inputmode', 'text');
    
    if (debugMode) {
      console.log('[AndroidComposition] Swype optimizations applied');
    }
  }, [enableSwypeOptimization, keyboardType, debugMode]);

  // Enhanced composition start handler
  const handleCompositionStart = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;

    compositionState.current.isComposing = true;
    compositionState.current.compositionLength = 0;
    compositionState.current.hasSwipeGesture = keyboardType === 'swype' || 
                                              keyboardType === 'gboard' || 
                                              keyboardType === 'samsung';

    // Apply unified touch action management
    if (inputRef.current) {
      touchActionId.current = touchActionManager.optimizeForComposition(inputRef.current);
    }

    // Apply keyboard-specific optimizations
    optimizeForGboard(inputRef.current);
    optimizeForSamsung(inputRef.current);
    optimizeForSwype(inputRef.current);

    if (debugMode) {
      console.log('[AndroidComposition] Enhanced composition start:', {
        keyboardType,
        androidVersion,
        webViewVersion,
        hasSwipeGesture: compositionState.current.hasSwipeGesture,
        capacitorHeight: compositionState.current.capacitorKeyboardHeight
      });
    }

    // Dispatch enhanced event
    window.dispatchEvent(new CustomEvent('androidCompositionStart', {
      detail: {
        element: inputRef.current,
        keyboardType,
        androidVersion,
        hasSwipeGesture: compositionState.current.hasSwipeGesture,
        capacitorKeyboardHeight: compositionState.current.capacitorKeyboardHeight
      }
    }));
  }, [
    inputRef, 
    keyboardType, 
    androidVersion, 
    webViewVersion,
    touchActionManager,
    optimizeForGboard,
    optimizeForSamsung,
    optimizeForSwype,
    debugMode
  ]);

  // Enhanced composition update handler
  const handleCompositionUpdate = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;

    compositionState.current.compositionLength = e.data?.length || 0;

    // Android-specific composition update handling
    if (compositionState.current.hasSwipeGesture) {
      // Clear any existing timers
      compositionTimers.current.forEach(timer => clearTimeout(timer));
      compositionTimers.current.clear();

      // Delayed input event for swipe keyboards
      const timer = setTimeout(() => {
        if (inputRef.current && compositionState.current.isComposing) {
          // Gentle input event that doesn't interfere with composition
          const syntheticEvent = new Event('input', { bubbles: false });
          inputRef.current.dispatchEvent(syntheticEvent);
        }
      }, 16); // One frame delay

      compositionTimers.current.add(timer);
    }

    if (debugMode) {
      console.log('[AndroidComposition] Enhanced composition update:', {
        length: compositionState.current.compositionLength,
        data: e.data,
        hasSwipeGesture: compositionState.current.hasSwipeGesture
      });
    }
  }, [inputRef, debugMode]);

  // Enhanced composition end handler
  const handleCompositionEnd = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;

    const wasComposing = compositionState.current.isComposing;
    compositionState.current.isComposing = false;
    compositionState.current.compositionLength = 0;

    // Clear timers
    compositionTimers.current.forEach(timer => clearTimeout(timer));
    compositionTimers.current.clear();

    // Remove touch action optimization
    if (touchActionId.current) {
      touchActionManager.removeTouchAction(touchActionId.current);
      touchActionId.current = null;
    }

    // Android-specific cleanup
    if (wasComposing && compositionState.current.hasSwipeGesture) {
      // Ensure final input event for swipe keyboards
      setTimeout(() => {
        if (inputRef.current) {
          const finalEvent = new Event('input', { bubbles: true });
          inputRef.current.dispatchEvent(finalEvent);
        }
      }, 50);
    }

    if (debugMode) {
      console.log('[AndroidComposition] Enhanced composition end:', {
        finalText: e.data,
        wasSwipeGesture: compositionState.current.hasSwipeGesture,
        keyboardType
      });
    }

    // Dispatch enhanced event
    window.dispatchEvent(new CustomEvent('androidCompositionEnd', {
      detail: {
        element: inputRef.current,
        finalText: e.data,
        keyboardType,
        wasSwipeGesture: compositionState.current.hasSwipeGesture
      }
    }));
  }, [inputRef, touchActionManager, keyboardType, debugMode]);

  // Setup event listeners and Capacitor integration
  useEffect(() => {
    if (!hasCompositionSupport || !inputRef.current) return;

    const element = inputRef.current;

    // Setup Capacitor integration
    handleCapacitorKeyboard();

    // Setup composition events
    element.addEventListener('compositionstart', handleCompositionStart);
    element.addEventListener('compositionupdate', handleCompositionUpdate);
    element.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      element.removeEventListener('compositionstart', handleCompositionStart);
      element.removeEventListener('compositionupdate', handleCompositionUpdate);
      element.removeEventListener('compositionend', handleCompositionEnd);

      // Cleanup timers
      compositionTimers.current.forEach(timer => clearTimeout(timer));
      compositionTimers.current.clear();

      // Cleanup touch actions
      if (touchActionId.current) {
        touchActionManager.removeTouchAction(touchActionId.current);
      }
    };
  }, [
    hasCompositionSupport,
    inputRef,
    handleCapacitorKeyboard,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    touchActionManager
  ]);

  return {
    isAndroid: true,
    isComposing: compositionState.current.isComposing,
    hasSwipeGesture: compositionState.current.hasSwipeGesture,
    compositionLength: compositionState.current.compositionLength,
    keyboardBrand: compositionState.current.keyboardBrand,
    capacitorKeyboardHeight: compositionState.current.capacitorKeyboardHeight,
    androidVersion,
    webViewVersion,
    keyboardType
  };
};